import { and, eq, or, sql } from "drizzle-orm";
import { database, type TX } from "./db";
import { blocks, friendships, grants, users } from "./schema";
import { AppError } from "./security";
import type { Grant } from "../lib/types";
export const pair = (one: string, two: string) =>
  [one, two].sort() as [string, string];
export const pairWhere = (a: string, b: string) =>
  and(eq(friendships.a, a), eq(friendships.b, b));
export async function pairLock(tx: TX, one: string, two: string) {
  const [a, b] = pair(one, two);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`friends:${a}:${b}`}))`,
  );
  return [a, b] as const;
}
export async function saveGrant(
  tx: TX,
  owner: string,
  viewer: string,
  grant: Grant,
) {
  await tx
    .insert(grants)
    .values({ owner, viewer, ...grant })
    .onConflictDoUpdate({ target: [grants.owner, grants.viewer], set: grant });
}
export async function requestFriend(
  sender: string,
  target: string,
  giving: Grant,
  targetGiving?: Grant,
) {
  if (sender === target) throw new AppError("self_request");
  return database().transaction(async (tx) => {
    const [a, b] = await pairLock(tx, sender, target);
    const blocked = await tx
      .select()
      .from(blocks)
      .where(
        or(
          and(eq(blocks.owner, a), eq(blocks.target, b)),
          and(eq(blocks.owner, b), eq(blocks.target, a)),
        ),
      );
    if (blocked.length) throw new AppError("request_unavailable", 403);
    const [existing] = await tx
      .select()
      .from(friendships)
      .where(pairWhere(a, b));
    if (existing) throw new AppError("request_exists", 409);
    await tx
      .insert(friendships)
      .values({ a, b, requester: sender, status: "pending" });
    await saveGrant(tx, sender, target, giving);
    if (targetGiving) await saveGrant(tx, target, sender, targetGiving);
  });
}
export async function friendList(userId: string) {
  const relations = await database()
    .select()
    .from(friendships)
    .where(or(eq(friendships.a, userId), eq(friendships.b, userId)));
  return Promise.all(
    relations.map(async (f) => {
      const other = f.a === userId ? f.b : f.a;
      const [user] = await database()
        .select({ id: users.id, username: users.username, name: users.name })
        .from(users)
        .where(eq(users.id, other));
      const permissions = await database()
        .select()
        .from(grants)
        .where(
          or(
            and(eq(grants.owner, userId), eq(grants.viewer, other)),
            and(eq(grants.owner, other), eq(grants.viewer, userId)),
          ),
        );
      const giving = permissions.find((g) => g.owner === userId);
      const receiving = permissions.find((g) => g.owner === other);
      return {
        ...user,
        status: f.status,
        incoming: f.requester !== userId,
        giving: {
          calendar: giving?.calendar ?? false,
          plans: giving?.plans ?? false,
        },
        receiving: {
          calendar: f.status === "accepted" && (receiving?.calendar ?? false),
          plans: f.status === "accepted" && (receiving?.plans ?? false),
        },
      };
    }),
  );
}
/** This expression is joined into every read of another person's data. */
export function acceptedGrant(viewer: string, kind: "calendar" | "plans") {
  return and(
    eq(grants.viewer, viewer),
    eq(grants[kind], true),
    eq(friendships.status, "accepted"),
    or(
      and(eq(friendships.a, grants.owner), eq(friendships.b, grants.viewer)),
      and(eq(friendships.b, grants.owner), eq(friendships.a, grants.viewer)),
    ),
  );
}
