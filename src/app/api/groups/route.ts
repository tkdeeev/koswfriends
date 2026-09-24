import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { groups, members, overrides, users } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import { AppError } from "@/server/security";
import { canRead, isBlocked, saveOverride } from "@/server/sharing";
import { pairLock } from "@/server/friends";
export const dynamic = "force-dynamic";
const grant = z.object({ calendar: z.boolean(), plans: z.boolean() });
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const mine = await database()
    .select({
      id: groups.id,
      name: groups.name,
      owner: groups.owner,
      status: members.status,
      calendar: members.calendar,
      plans: members.plans,
    })
    .from(groups)
    .innerJoin(members, eq(members.groupId, groups.id))
    .where(eq(members.userId, user.id));
  const result = await Promise.all(
    mine.map(async (group) => {
      const roster =
        group.status === "accepted"
          ? await database()
              .select({
                id: users.id,
                username: users.username,
                name: users.name,
                status: members.status,
                blocked: isBlocked(user.id, users.id),
                givingCalendar: canRead(user.id, users.id, "calendar"),
                givingPlans: canRead(user.id, users.id, "plans"),
                receivingCalendar: canRead(users.id, user.id, "calendar"),
                receivingPlans: canRead(users.id, user.id, "plans"),
                overridden: sql<boolean>`exists (select 1 from sharing_overrides o where o.owner = ${user.id} and o.viewer = ${users.id})`,
              })
              .from(members)
              .innerJoin(users, eq(users.id, members.userId))
              .where(
                and(
                  eq(members.groupId, group.id),
                  group.owner === user.id
                    ? undefined
                    : eq(members.status, "accepted"),
                ),
              )
          : [];
      return {
        id: group.id,
        name: group.name,
        owner: group.owner,
        status: group.status,
        giving: { calendar: group.calendar, plans: group.plans },
        members: roster.map((m) => ({
          id: m.id,
          username: m.username,
          name: m.name,
          status: m.status,
          blocked: m.blocked,
          overridden: m.overridden,
          giving: { calendar: m.givingCalendar, plans: m.givingPlans },
          receiving: { calendar: m.receivingCalendar, plans: m.receivingPlans },
        })),
      };
    }),
  );
  return json({ groups: result });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({ name: z.string().trim().min(1).max(80), giving: grant })
    .parse(await body(req));
  const id = await database().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`groups:${user.id}`}))`,
    );
    const count = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.owner, user.id));
    if (count.length >= 20) throw new AppError("groups_full");
    const [group] = await tx
      .insert(groups)
      .values({ owner: user.id, name: data.name })
      .returning();
    await tx
      .insert(members)
      .values({
        groupId: group.id,
        userId: user.id,
        status: "accepted",
        ...data.giving,
      });
    return group.id;
  });
  return json({ ok: true, id });
});
export const PATCH = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({
      id: z.uuid(),
      action: z.enum([
        "invite",
        "accept",
        "decline",
        "sharing",
        "override",
        "reset",
        "remove",
        "leave",
        "delete",
        "rename",
      ]),
      target: z.uuid().optional(),
      username: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9._-]{1,80}$/)
        .optional(),
      name: z.string().trim().min(1).max(80).optional(),
      giving: grant.optional(),
    })
    .parse(await body(req));
  await database().transaction(async (tx) => {
    // Serialize membership changes, owner deletion and simultaneous invitations.
    const [group] = await tx
      .select()
      .from(groups)
      .where(eq(groups.id, data.id))
      .for("update");
    const membership = and(
      eq(members.groupId, data.id),
      eq(members.userId, user.id),
    );
    const [mine] = await tx.select().from(members).where(membership);
    if (!group || !mine) throw new AppError("sharing_group_not_found", 404);
    const admin = group.owner === user.id;
    if (data.action === "accept" || data.action === "decline") {
      if (mine.status !== "pending") throw new AppError("invalid_request");
      if (data.action === "decline") await tx.delete(members).where(membership);
      else {
        if (!data.giving) throw new AppError("invalid_request");
        await tx
          .update(members)
          .set({ status: "accepted", ...data.giving })
          .where(membership);
      }
      return;
    }
    if (mine.status !== "accepted") throw new AppError("forbidden", 403);
    if (
      ["invite", "remove", "delete", "rename"].includes(data.action) &&
      !admin
    )
      throw new AppError("forbidden", 403);
    if (data.action === "invite") {
      if (!data.username) throw new AppError("invalid_request");
      const [target] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, data.username.toLowerCase()));
      if (!target) throw new AppError("user_not_registered", 404);
      if (target.id === user.id) throw new AppError("self_request");
      await pairLock(tx, user.id, target.id);
      const [blocked] = await tx
        .select({ blocked: isBlocked(user.id, target.id) })
        .from(users)
        .where(eq(users.id, user.id));
      if (blocked.blocked) throw new AppError("request_unavailable", 403);
      const all = await tx
        .select({ id: members.userId })
        .from(members)
        .where(eq(members.groupId, data.id));
      if (all.some((m) => m.id === target.id))
        throw new AppError("member_exists", 409);
      if (all.length >= 100) throw new AppError("group_full");
      await tx
        .insert(members)
        .values({ groupId: data.id, userId: target.id, status: "pending" });
    } else if (data.action === "sharing") {
      if (!data.giving) throw new AppError("invalid_request");
      await tx.update(members).set(data.giving).where(membership);
    } else if (data.action === "override" || data.action === "reset") {
      if (!data.target || data.target === user.id)
        throw new AppError("invalid_request");
      const [target] = await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.groupId, data.id),
            eq(members.userId, data.target),
            eq(members.status, "accepted"),
          ),
        );
      if (!target) throw new AppError("member_not_found", 404);
      await pairLock(tx, user.id, data.target);
      if (data.action === "reset")
        await tx
          .delete(overrides)
          .where(
            and(
              eq(overrides.owner, user.id),
              eq(overrides.viewer, data.target),
            ),
          );
      else {
        if (!data.giving) throw new AppError("invalid_request");
        await saveOverride(tx, user.id, data.target, data.giving);
      }
    } else if (data.action === "leave") {
      if (admin) throw new AppError("owner_cannot_leave");
      await tx.delete(members).where(membership);
    } else if (data.action === "remove") {
      if (!data.target || data.target === user.id)
        throw new AppError("invalid_request");
      await tx
        .delete(members)
        .where(
          and(eq(members.groupId, data.id), eq(members.userId, data.target)),
        );
    } else if (data.action === "delete")
      await tx.delete(groups).where(eq(groups.id, data.id));
    else if (data.action === "rename") {
      if (!data.name) throw new AppError("invalid_request");
      await tx
        .update(groups)
        .set({ name: data.name })
        .where(eq(groups.id, data.id));
    }
  });
  return json({ ok: true });
});
