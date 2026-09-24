import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database } from "@/server/db";
import { friendships, grants, plans, users } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import { acceptedGrant } from "@/server/friends";
import { AppError } from "@/server/security";
import { accessToken } from "@/server/oauth";
import { fetchEvents, resolveSemester } from "@/server/sirius";
import type { Choice } from "@/lib/types";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const semester = z
    .string()
    .regex(/^B\d{2}[12]$/)
    .parse(req.nextUrl.searchParams.get("semester") || user.semester);
  const [own] = await database()
    .select()
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.semester, semester)));
  const shared = await database()
    .select({
      userId: users.id,
      username: users.username,
      choices: plans.choices,
      updatedAt: plans.updatedAt,
    })
    .from(grants)
    .innerJoin(friendships, acceptedGrant(user.id, "plans"))
    .innerJoin(users, eq(users.id, grants.owner))
    .leftJoin(
      plans,
      and(eq(plans.userId, grants.owner), eq(plans.semester, semester)),
    );
  return json({
    choices: own?.choices || [],
    updatedAt: own?.updatedAt || null,
    shared: shared.map((p) => ({ ...p, choices: p.choices || [] })),
  });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({
      semester: z.string().regex(/^B\d{2}[12]$/),
      action: z.enum(["add", "remove", "note"]),
      id: z.uuid().optional(),
      course: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9.:-]{1,80}$/)
        .optional(),
      group: z.string().min(1).max(100).nullable().optional(),
      note: z.string().max(1000).default(""),
    })
    .parse(await body(req));
  let choice: Choice | undefined;
  if (data.action === "add") {
    if (!data.course) throw new AppError("invalid_request");
    let events: Choice["events"] = [];
    if (data.group) {
      const token = await accessToken(user.id);
      events = (
        await fetchEvents(
          token,
          `/courses/${encodeURIComponent(data.course)}/events`,
          await resolveSemester(token, data.semester),
        )
      ).filter((e) => `${e.type}:${e.group}` === data.group);
      if (!events.some((e) => !e.cancelled))
        throw new AppError("group_unavailable");
    }
    choice = {
      id: randomUUID(),
      course: data.course,
      title: events[0]?.title || { cs: data.course, en: data.course },
      group: data.group || null,
      note: data.note,
      verified: !!data.group,
      events,
    };
  }
  await database().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`plan:${user.id}:${data.semester}`}))`,
    );
    const where = and(
      eq(plans.userId, user.id),
      eq(plans.semester, data.semester),
    );
    const [old] = await tx.select().from(plans).where(where);
    let choices = old?.choices || [];
    if (choice) {
      if (choices.length >= 80) throw new AppError("plan_full");
      if (
        choices.some(
          (c) => c.course === choice!.course && c.group === choice!.group,
        )
      )
        throw new AppError("choice_exists", 409);
      choices = [...choices, choice];
    } else {
      if (!data.id || !choices.some((c) => c.id === data.id))
        throw new AppError("choice_not_found", 404);
      choices =
        data.action === "remove"
          ? choices.filter((c) => c.id !== data.id)
          : choices.map((c) =>
              c.id === data.id ? { ...c, note: data.note } : c,
            );
    }
    await tx
      .insert(plans)
      .values({ userId: user.id, semester: data.semester, choices })
      .onConflictDoUpdate({
        target: [plans.userId, plans.semester],
        set: { choices, updatedAt: new Date() },
      });
  });
  return json({ ok: true });
});
