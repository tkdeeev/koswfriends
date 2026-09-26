import { and, eq, gt, lt, or } from "drizzle-orm";
import { database, closeDatabase } from "./db";
import {
  attempts,
  connections,
  invites,
  sessions,
  snapshots,
  users,
  workerStatus,
} from "./schema";
import { synchronize } from "./sync";
import { applyRetention, RETENTION_INTERVAL_MS } from "./retention";
let stopping = false;
let nextRetentionAt = 0;
async function heartbeat() {
  try {
    await database()
      .insert(workerStatus)
      .values({ id: "sync", heartbeat: new Date() })
      .onConflictDoUpdate({
        target: workerStatus.id,
        set: { heartbeat: new Date() },
      });
  } catch {
    console.error("worker_heartbeat_failed");
  }
}
const timer = setInterval(heartbeat, 30000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
  });
await heartbeat();
while (!stopping) {
  try {
    if (Date.now() >= nextRetentionAt) {
      await applyRetention();
      nextRetentionAt = Date.now() + RETENTION_INTERVAL_MS;
    }
    const accounts = await database()
      .select({ id: users.id, semester: users.semester })
      .from(users)
      .innerJoin(
        connections,
        and(eq(connections.userId, users.id), eq(connections.reconnect, false)),
      )
      .leftJoin(
        snapshots,
        and(
          eq(snapshots.userId, users.id),
          eq(snapshots.semester, users.semester),
        ),
      )
      .where(gt(users.activeAt, new Date(Date.now() - 7 * 86400000)));
    for (const user of accounts) {
      if (stopping) break;
      try {
        await synchronize(user.id, user.semester);
      } catch {
        console.error("worker_sync_failed");
      }
    }
    await database().delete(attempts).where(lt(attempts.expiresAt, new Date()));
    await database().delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await database()
      .delete(invites)
      .where(
        or(
          lt(invites.expiresAt, new Date(Date.now() - 7 * 86400000)),
          eq(invites.revoked, true),
        ),
      );
  } catch {
    console.error("worker_iteration_failed");
  }
  for (let i = 0; i < 60 && !stopping; i++)
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
clearInterval(timer);
await closeDatabase();
