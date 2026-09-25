import { DateTime } from "luxon";
import { z } from "zod";
import type { Lesson, Localized, Semester } from "../lib/types";
import { semesterWindow, ZONE } from "../lib/calendar";
import { config } from "./config";
import { AppError } from "./security";
import { providerJson } from "./oauth";
const rawEvent = z.object({
  id: z.union([z.string(), z.number()]),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  event_type: z.string().nullish(),
  parallel: z.union([z.string(), z.number()]).nullish(),
  deleted: z.boolean().optional(),
  cancelled: z.boolean().optional(),
  name: z.unknown().optional(),
  links: z
    .object({
      course: z.union([z.string(), z.number()]).nullish(),
      room: z.union([z.string(), z.number()]).nullish(),
    })
    .optional(),
});
export function localized(value: unknown, fallback = ""): Localized {
  if (typeof value === "string") return { cs: value, en: value };
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return {
      cs: String(v.cs || v.cz || v.en || fallback),
      en: String(v.en || v.cs || v.cz || fallback),
    };
  }
  return { cs: fallback, en: fallback };
}
export function normalizePage(page: unknown) {
  const doc = z
    .object({
      events: z.array(rawEvent),
      linked: z
        .object({
          courses: z
            .array(
              z.object({
                id: z.union([z.string(), z.number()]),
                name: z.unknown(),
              }),
            )
            .optional(),
        })
        .optional(),
      meta: z
        .object({
          count: z.number().int().nonnegative(),
          offset: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .safeParse(page);
  if (!doc.success) throw new AppError("provider_format", 502);
  const courses = new Map(
    doc.data.linked?.courses?.map((c) => [String(c.id), c.name]),
  );
  const events: Lesson[] = doc.data.events.map((e) => {
    if (Date.parse(e.ends_at) <= Date.parse(e.starts_at))
      throw new AppError("provider_format", 502);
    const course = String(e.links?.course || "");
    return {
      id: String(e.id),
      course,
      title: localized(courses.get(course) || e.name, course),
      type: e.event_type || "",
      group: String(e.parallel ?? ""),
      start: e.starts_at,
      end: e.ends_at,
      room: String(e.links?.room || ""),
      cancelled: e.deleted === true || e.cancelled === true,
    };
  });
  return { events, count: doc.data.meta?.count, offset: doc.data.meta?.offset };
}
export async function sirius(
  token: string,
  path: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${config().siriusUrl}${path}`);
  url.search = new URLSearchParams(params).toString();
  return providerJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
}
/** Keep only the signed-in person's display name, never the provider's calendar token. */
export async function fetchPersonName(token: string, username: string) {
  const response = await sirius(
    token,
    `/people/${encodeURIComponent(username)}`,
  );
  const parsed = z
    .object({
      people: z.object({
        id: z.string(),
        full_name: z.string().trim().min(1).max(200),
      }),
    })
    .safeParse(response);
  if (
    !parsed.success ||
    parsed.data.people.id.toLowerCase() !== username.toLowerCase()
  )
    throw new AppError("provider_format", 502);
  return parsed.data.people.full_name.replace(/\s+/g, " ");
}

export async function resolveSemester(
  token: string,
  code: string,
): Promise<Semester> {
  const fallback = semesterWindow(code);
  // Cover all represented faculties rather than assuming every user studies at FIT.
  try {
    let offset = 0;
    let count = Infinity;
    const ranges: { from: number; to: number }[] = [];
    while (offset < count && offset < 20000) {
      const doc = await sirius(token, "/semesters", {
        limit: "100",
        offset: String(offset),
      });
      if (!Array.isArray(doc.semesters))
        throw new AppError("provider_format", 502);
      for (const s of doc.semesters)
        if (s.semester === code) {
          const from = DateTime.fromISO(s.starts_at, { zone: ZONE });
          const to = DateTime.fromISO(s.ends_at, { zone: ZONE }).plus({
            days: 1,
          });
          if (from.isValid && to.isValid && to > from)
            ranges.push({ from: from.toMillis(), to: to.toMillis() });
        }
      offset += doc.semesters.length;
      count =
        typeof doc.meta?.count === "number"
          ? doc.meta.count
          : doc.semesters.length < 100
            ? offset
            : Infinity;
      if (!doc.semesters.length) break;
    }
    if (ranges.length && offset >= count)
      return {
        code,
        from: new Date(Math.min(...ranges.map((r) => r.from))).toISOString(),
        to: new Date(Math.max(...ranges.map((r) => r.to))).toISOString(),
        verified: true,
      };
  } catch {
    /* Explicit estimated-period state remains visible; personal import can still work. */
  }
  return fallback;
}
export async function fetchEvents(
  token: string,
  path: string,
  window: Semester,
) {
  const result = new Map<string, Lesson>();
  let offset = 0;
  let total: number | undefined;
  for (let page = 0; page < 200; page++) {
    const normalized = normalizePage(
      await sirius(token, path, {
        from: window.from,
        to: window.to,
        limit: "100",
        offset: String(offset),
        deleted: "true",
        include: "courses",
      }),
    );
    if (normalized.offset !== undefined && normalized.offset !== offset)
      throw new AppError("incomplete_import", 502);
    if (
      total !== undefined &&
      normalized.count !== undefined &&
      total !== normalized.count
    )
      throw new AppError("incomplete_import", 502);
    total = normalized.count;
    for (const event of normalized.events) {
      if (result.has(event.id)) throw new AppError("incomplete_import", 502);
      result.set(event.id, event);
    }
    offset += normalized.events.length;
    if (total !== undefined ? offset === total : normalized.events.length < 100)
      return [...result.values()];
    if (!normalized.events.length || (total !== undefined && offset > total))
      throw new AppError("incomplete_import", 502);
  }
  throw new AppError("incomplete_import", 502);
}
