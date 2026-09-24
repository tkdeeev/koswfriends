import { and, eq, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { database } from "@/server/db";
import { personalEvents } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import { AppError } from "@/server/security";
import { ZONE } from "@/lib/calendar";
export const dynamic = "force-dynamic";
const semesterCode = z.string().regex(/^B\d{2}[12]$/);
const eventData = z
  .object({
    course: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(160),
    start: z.string().max(40),
    end: z.string().max(40),
    room: z.string().trim().max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    note: z.string().trim().max(1000),
    repeatUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .transform((value, ctx) => {
    const start = DateTime.fromISO(value.start, { zone: ZONE }),
      end = DateTime.fromISO(value.end, { zone: ZONE });
    const until = value.repeatUntil
      ? DateTime.fromISO(value.repeatUntil, { zone: ZONE })
      : null;
    if (
      !start.isValid ||
      !end.isValid ||
      start.year < 2020 ||
      start.year > 2100 ||
      end <= start ||
      end.diff(start, "hours").hours > 48 ||
      (until &&
        (!until.isValid ||
          until.startOf("day") < start.startOf("day") ||
          until.diff(start.startOf("day"), "days").days > 366))
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid event dates" });
      return z.NEVER;
    }
    return { ...value, start: start.toISO()!, end: end.toISO()! };
  });
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const semester = semesterCode.parse(
    req.nextUrl.searchParams.get("semester") || user.semester,
  );
  const rows = await database()
    .select()
    .from(personalEvents)
    .where(
      and(
        eq(personalEvents.owner, user.id),
        eq(personalEvents.semester, semester),
      ),
    );
  return json({
    events: rows.map((row) => ({
      ...row.details,
      id: row.id,
      semester: row.semester,
    })),
  });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({ semester: semesterCode, event: eventData })
    .parse(await body(req));
  const id = await database().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`events:${user.id}`}))`,
    );
    const existing = await tx
      .select({ id: personalEvents.id })
      .from(personalEvents)
      .where(
        and(
          eq(personalEvents.owner, user.id),
          eq(personalEvents.semester, data.semester),
        ),
      );
    if (existing.length >= 100) throw new AppError("events_full");
    const [row] = await tx
      .insert(personalEvents)
      .values({ owner: user.id, semester: data.semester, details: data.event })
      .returning({ id: personalEvents.id });
    return row.id;
  });
  return json({ ok: true, id });
});
export const PATCH = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({ id: z.uuid(), event: eventData })
    .parse(await body(req));
  const rows = await database()
    .update(personalEvents)
    .set({ details: data.event })
    .where(
      and(eq(personalEvents.owner, user.id), eq(personalEvents.id, data.id)),
    )
    .returning({ id: personalEvents.id });
  if (!rows.length) throw new AppError("event_not_found", 404);
  return json({ ok: true });
});
export const DELETE = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z.object({ id: z.uuid() }).parse(await body(req));
  const rows = await database()
    .delete(personalEvents)
    .where(
      and(eq(personalEvents.owner, user.id), eq(personalEvents.id, data.id)),
    )
    .returning({ id: personalEvents.id });
  if (!rows.length) throw new AppError("event_not_found", 404);
  return json({ ok: true });
});
