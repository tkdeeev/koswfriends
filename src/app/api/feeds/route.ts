import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { calendarFeeds, feedSnapshots } from "@/server/schema";
import { body, endpoint, json, session } from "@/server/http";
import { addFeed, removeFeed } from "@/server/feeds";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const feeds = await database()
    .select({
      id: calendarFeeds.id,
      name: calendarFeeds.name,
      lastSuccess: feedSnapshots.lastSuccess,
      error: feedSnapshots.error,
    })
    .from(calendarFeeds)
    .leftJoin(
      feedSnapshots,
      and(
        eq(feedSnapshots.feedId, calendarFeeds.id),
        eq(feedSnapshots.semester, user.semester),
      ),
    )
    .where(eq(calendarFeeds.userId, user.id));
  return json({ feeds });
});
export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = z
    .object({
      name: z.string().trim().min(1).max(80),
      url: z.string().trim().min(1).max(2048),
    })
    .parse(await body(req));
  return json({
    ok: true,
    ...(await addFeed(user.id, user.semester, data.name, data.url)),
  });
});
export const DELETE = endpoint(async (req) => {
  const { user } = await session(req, true);
  const { id } = z.object({ id: z.uuid() }).parse(await body(req));
  await removeFeed(user.id, id);
  return json({ ok: true });
});
