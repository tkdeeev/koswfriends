import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { groupInvites, groups, members, users } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import {
  AppError,
  decrypt,
  encrypt,
  hash,
  randomToken,
} from "@/server/security";
import { isBlocked } from "@/server/sharing";
import { pairLock } from "@/server/friends";
export const dynamic = "force-dynamic";
const tokenFormat = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const linkUrl = (token: string) =>
  `${process.env.APP_URL}/#groupInvite=${token}`;
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const id = z.uuid().parse(req.nextUrl.searchParams.get("group"));
  const [row] = await database()
    .select({ token: groupInvites.token, expiresAt: groupInvites.expiresAt })
    .from(groups)
    .leftJoin(
      groupInvites,
      and(
        eq(groupInvites.groupId, groups.id),
        gt(groupInvites.expiresAt, new Date()),
      ),
    )
    .where(and(eq(groups.id, id), eq(groups.owner, user.id)));
  if (!row) throw new AppError("sharing_group_not_found", 404);
  return json({
    link: row.token
      ? { url: linkUrl(decrypt(row.token)), expiresAt: row.expiresAt }
      : null,
  });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("create"), groupId: z.uuid() }),
      z.object({ action: z.literal("preview"), token: tokenFormat }),
      z.object({
        action: z.literal("join"),
        token: tokenFormat,
        giving: z.object({ calendar: z.boolean(), plans: z.boolean() }),
      }),
    ])
    .parse(await body(req));
  if (data.action === "create") {
    return database().transaction(async (tx) => {
      const [group] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, data.groupId), eq(groups.owner, user.id)))
        .for("update");
      if (!group) throw new AppError("sharing_group_not_found", 404);
      const token = randomToken(),
        expiresAt = new Date(Date.now() + 7 * 86400000);
      const values = { hash: hash(token), token: encrypt(token), expiresAt };
      await tx
        .insert(groupInvites)
        .values({ groupId: group.id, ...values })
        .onConflictDoUpdate({ target: groupInvites.groupId, set: values });
      return json({ ok: true, link: { url: linkUrl(token), expiresAt } });
    });
  }
  const digest = hash(data.token);
  // Preview reveals no roster or private timetable and never creates membership.
  if (data.action === "preview") {
    const [row] = await database()
      .select({
        id: groups.id,
        name: groups.name,
        owner: users.username,
        expiresAt: groupInvites.expiresAt,
        status: members.status,
      })
      .from(groupInvites)
      .innerJoin(groups, eq(groups.id, groupInvites.groupId))
      .innerJoin(users, eq(users.id, groups.owner))
      .leftJoin(
        members,
        and(eq(members.groupId, groups.id), eq(members.userId, user.id)),
      )
      .where(
        and(
          eq(groupInvites.hash, digest),
          gt(groupInvites.expiresAt, new Date()),
        ),
      );
    if (!row) throw new AppError("invite_expired", 410);
    return json({ group: { ...row, joined: row.status === "accepted" } });
  }
  return database().transaction(async (tx) => {
    // All membership/link changes lock the group first. Recheck the token after
    // locking so concurrent rotation, revocation or removal cannot be bypassed.
    const [candidate] = await tx
      .select({ id: groupInvites.groupId })
      .from(groupInvites)
      .where(eq(groupInvites.hash, digest));
    if (!candidate) throw new AppError("invite_expired", 410);
    const [group] = await tx
      .select()
      .from(groups)
      .where(eq(groups.id, candidate.id))
      .for("update");
    const [invite] = await tx
      .select()
      .from(groupInvites)
      .where(
        and(
          eq(groupInvites.groupId, candidate.id),
          eq(groupInvites.hash, digest),
          gt(groupInvites.expiresAt, new Date()),
        ),
      );
    if (!group || !invite) throw new AppError("invite_expired", 410);
    if (group.owner !== user.id) await pairLock(tx, group.owner, user.id);
    const [blocked] = await tx
      .select({ value: isBlocked(group.owner, user.id) })
      .from(users)
      .where(eq(users.id, user.id));
    if (blocked.value) throw new AppError("request_unavailable", 403);
    const membership = and(
      eq(members.groupId, group.id),
      eq(members.userId, user.id),
    );
    const [current] = await tx.select().from(members).where(membership);
    if (current?.status === "accepted")
      return json({ ok: true, groupId: group.id, alreadyMember: true });
    const roster = await tx
      .select({ id: members.userId })
      .from(members)
      .where(eq(members.groupId, group.id));
    if (!current && roster.length >= 100) throw new AppError("group_full");
    await tx
      .insert(members)
      .values({
        groupId: group.id,
        userId: user.id,
        status: "accepted",
        ...data.giving,
      })
      .onConflictDoUpdate({
        target: [members.groupId, members.userId],
        set: { status: "accepted", ...data.giving },
      });
    return json({ ok: true, groupId: group.id });
  });
});
export const DELETE = endpoint(async (req) => {
  const { user } = await session(req, true);
  const { groupId } = z.object({ groupId: z.uuid() }).parse(await body(req));
  await database().transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.owner, user.id)))
      .for("update");
    if (!group) throw new AppError("sharing_group_not_found", 404);
    await tx.delete(groupInvites).where(eq(groupInvites.groupId, groupId));
  });
  return json({ ok: true });
});
