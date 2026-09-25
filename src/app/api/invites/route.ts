import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { invites, users } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import { AppError, hash, randomToken } from "@/server/security";
import { requestFriend } from "@/server/friends";
export const dynamic = "force-dynamic";
const permission = z.object({ calendar: z.boolean(), plans: z.boolean() });
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const [invite] = await database()
      .select({
        username: users.username,
        name: users.name,
        expiresAt: invites.expiresAt,
      })
      .from(invites)
      .innerJoin(users, eq(users.id, invites.owner))
      .where(
        and(
          eq(invites.hash, hash(token)),
          eq(invites.revoked, false),
          gt(invites.expiresAt, new Date()),
        ),
      );
    if (!invite) throw new AppError("invite_expired", 410);
    return json(invite);
  }
  return json({
    invites: await database()
      .select({
        id: invites.id,
        expiresAt: invites.expiresAt,
        revoked: invites.revoked,
        calendar: invites.calendar,
        plans: invites.plans,
      })
      .from(invites)
      .where(eq(invites.owner, user.id)),
  });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("create"), giving: permission }),
      z.object({
        action: z.literal("join"),
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        giving: permission,
      }),
    ])
    .parse(await body(req));
  if (data.action === "create") {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const [invite] = await database()
      .insert(invites)
      .values({ hash: hash(token), owner: user.id, ...data.giving, expiresAt })
      .returning({ id: invites.id });
    return json({
      id: invite.id,
      url: `${process.env.APP_URL}/?invite=${token}`,
      expiresAt,
    });
  }
  // Hold the invite row lock until request creation completes, so revocation cannot race it.
  await database().transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.hash, hash(data.token)),
          eq(invites.revoked, false),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .for("update");
    if (!invite) throw new AppError("invite_expired", 410);
    await requestFriend(user.id, invite.owner, data.giving, {
      calendar: invite.calendar,
      plans: invite.plans,
    });
  });
  return json({ ok: true });
});
export const DELETE = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z.object({ id: z.uuid() }).parse(await body(req));
  await database()
    .update(invites)
    .set({ revoked: true })
    .where(and(eq(invites.id, data.id), eq(invites.owner, user.id)));
  return json({ ok: true });
});
