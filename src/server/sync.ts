import { and, eq, sql } from "drizzle-orm";
import { database } from "./db";
import { connections, snapshots, users } from "./schema";
import { accessToken } from "./oauth";
import { fetchEvents, fetchPersonName, resolveSemester } from "./sirius";
import { AppError, safeCode } from "./security";
import { semesterWindow } from "../lib/calendar";
export async function synchronize(
  userId: string,
  semester: string,
  manual = false,
) {
  return database().transaction(async (tx) => {
    // Cross-process lease, released automatically on failure/crash.
    const lock = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext(${`sync:${userId}:${semester}`})) as acquired`,
    );
    if (!lock[0]?.acquired) throw new AppError("sync_busy", 409);
    const where = and(
      eq(snapshots.userId, userId),
      eq(snapshots.semester, semester),
    );
    const [old] = await tx.select().from(snapshots).where(where);
    if (
      old?.lastAttempt &&
      Date.now() - old.lastAttempt.getTime() < (manual ? 60000 : 15 * 60000)
    ) {
      if (manual) throw new AppError("sync_cooldown", 429);
      return;
    }
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) return;
    await tx
      .insert(snapshots)
      .values({
        userId,
        semester,
        window: semesterWindow(semester),
        lastAttempt: new Date(),
      })
      .onConflictDoUpdate({
        target: [snapshots.userId, snapshots.semester],
        set: { lastAttempt: new Date() },
      });
    try {
      const token = await accessToken(userId);
      const [window, name] = await Promise.all([
        resolveSemester(token, semester),
        // Profile availability must not prevent timetable imports or erase a known name.
        fetchPersonName(token, user.username).catch(() => null),
      ]);
      const events = await fetchEvents(
        token,
        `/people/${encodeURIComponent(user.username)}/events`,
        window,
      );
      if (name && name !== user.name)
        await tx.update(users).set({ name }).where(eq(users.id, userId));
      await tx
        .update(snapshots)
        .set({ events, window, lastSuccess: new Date(), error: null })
        .where(where);
      return { ok: true, count: events.length };
    } catch (error) {
      const code = safeCode(error);
      if (code === "provider_denied")
        await tx
          .update(connections)
          .set({ reconnect: true })
          .where(eq(connections.userId, userId));
      await tx.update(snapshots).set({ error: code }).where(where);
      return { ok: false, error: code };
    }
  });
}
