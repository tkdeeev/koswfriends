import { z } from "zod";
import { endpoint, json, session } from "@/server/http";
import { accessToken } from "@/server/oauth";
import {
  fetchEvents,
  localized,
  resolveSemester,
  sirius,
} from "@/server/sirius";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const token = await accessToken(user.id);
  const course = req.nextUrl.searchParams.get("course");
  if (course) {
    z.string()
      .regex(/^[a-zA-Z0-9.:-]{1,80}$/)
      .parse(course);
    const semester = z
      .string()
      .regex(/^B\d{2}[12]$/)
      .parse(req.nextUrl.searchParams.get("semester") || user.semester);
    const events = await fetchEvents(
      token,
      `/courses/${encodeURIComponent(course)}/events`,
      await resolveSemester(token, semester),
    );
    const groups = [
      ...new Set(
        events.filter((e) => !e.cancelled).map((e) => `${e.type}:${e.group}`),
      ),
    ].map((key) => ({
      key,
      events: events.filter((e) => `${e.type}:${e.group}` === key),
    }));
    return json({ groups });
  }
  const query = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .parse(req.nextUrl.searchParams.get("q"));
  const doc = await sirius(token, "/search", { q: query, limit: "50" });
  const results = z
    .object({
      results: z.array(
        z.object({
          type: z.string(),
          id: z.union([z.string(), z.number()]),
          title: z.unknown(),
        }),
      ),
    })
    .parse(doc).results;
  return json({
    courses: results
      .filter((r) => r.type === "course")
      .map((r) => ({
        code: String(r.id),
        title: localized(r.title, String(r.id)),
      })),
  });
});
