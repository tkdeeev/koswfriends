import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { blocks, friendships, grants, users } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import {
  friendList,
  pairLock,
  pairWhere,
  requestFriend,
  saveGrant,
} from "@/server/friends";
import { related, saveOverride } from "@/server/sharing";
import { AppError } from "@/server/security";
export const dynamic = "force-dynamic";
const grant = z.object({ calendar: z.boolean(), plans: z.boolean() });
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const blocked = await database()
    .select({ id: users.id, username: users.username })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.target))
    .where(eq(blocks.owner, user.id));
  return json({ friends: await friendList(user.id), blocked });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({
      username: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9._-]{1,80}$/),
      giving: grant,
    })
    .parse(await body(req));
  const [target] = await database()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, data.username.toLowerCase()));
  if (!target) throw new AppError("user_not_registered", 404);
  await requestFriend(user.id, target.id, data.giving);
  return json({ ok: true });
});
export const PATCH = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({
      id: z.uuid(),
      action: z.enum([
        "accept",
        "decline",
        "sharing",
        "remove",
        "block",
        "unblock",
      ]),
      giving: grant.optional(),
    })
    .parse(await body(req));
  if (data.id === user.id) throw new AppError("self_request");
  await database().transaction(async (tx) => {
    const [a, b] = await pairLock(tx, user.id, data.id);
    if (data.action === "unblock") {
      await tx
        .delete(blocks)
        .where(and(eq(blocks.owner, user.id), eq(blocks.target, data.id)));
      return;
    }
    const [friend] = await tx.select().from(friendships).where(pairWhere(a, b));
    if (!friend && data.action === "block") {
      const [contact] = await tx
        .select({ connected: related(user.id, data.id) })
        .from(users)
        .where(eq(users.id, data.id));
      if (!contact?.connected) throw new AppError("friend_not_found", 404);
    } else if (!friend) throw new AppError("friend_not_found", 404);
    if (data.action === "accept") {
      if (
        friend!.status !== "pending" ||
        friend!.requester === user.id ||
        !data.giving
      )
        throw new AppError("invalid_request");
      await tx
        .update(friendships)
        .set({ status: "accepted" })
        .where(pairWhere(a, b));
      await saveGrant(tx, user.id, data.id, data.giving);
    } else if (data.action === "sharing") {
      if (friend!.status !== "accepted" || !data.giving)
        throw new AppError("invalid_request");
      await saveGrant(tx, user.id, data.id, data.giving);
      await saveOverride(tx, user.id, data.id, data.giving);
    } else {
      if (data.action === "block")
        await tx
          .insert(blocks)
          .values({ owner: user.id, target: data.id })
          .onConflictDoNothing();
      await tx.delete(friendships).where(pairWhere(a, b));
      await tx
        .delete(grants)
        .where(
          or(
            and(eq(grants.owner, a), eq(grants.viewer, b)),
            and(eq(grants.owner, b), eq(grants.viewer, a)),
          ),
        );
    }
  });
  return json({ ok: true });
});
