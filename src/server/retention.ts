import { lt } from "drizzle-orm";
import { database } from "./db";
import { groupInvites, users } from "./schema";

export const INACTIVE_ACCOUNT_DAYS = 365;
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** User activity renews retention; background synchronization never does. */
export async function applyRetention(now = new Date()) {
  const cutoff = new Date(
    now.getTime() - INACTIVE_ACCOUNT_DAYS * RETENTION_INTERVAL_MS,
  );
  if (!Number.isFinite(cutoff.getTime()))
    throw new Error("invalid_retention_time");
  await database().transaction(async (tx) => {
    // The predicate and deletion stay in one statement so a concurrent activity
    // update is rechecked by PostgreSQL before its row can be removed.
    await tx.delete(users).where(lt(users.activeAt, cutoff));
    await tx.delete(groupInvites).where(lt(groupInvites.expiresAt, now));
  });
}
