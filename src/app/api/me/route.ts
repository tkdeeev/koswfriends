import { eq } from "drizzle-orm";
import { z } from "zod";
import { after } from "next/server";
import { database } from "@/server/db";
import { connections, users } from "@/server/schema";
import {
  body,
  endpoint,
  json,
  session,
  SESSION_COOKIE,
  cookieOptions,
} from "@/server/http";
import { synchronize } from "@/server/sync";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const row = await session(req);
  const [connection] = await database()
    .select({ reconnect: connections.reconnect })
    .from(connections)
    .where(eq(connections.userId, row.user.id));
  return json({
    id: row.user.id,
    username: row.user.username,
    name: row.user.name,
    semester: row.user.semester,
    csrf: row.session.csrf,
    reconnect: connection?.reconnect ?? true,
  });
});
export const PATCH = endpoint(async (req) => {
  const row = await session(req, true);
  const data = z
    .object({ semester: z.string().regex(/^B\d{2}[12]$/) })
    .parse(await body(req));
  await database().update(users).set(data).where(eq(users.id, row.user.id));
  after(async () => {
    try {
      await synchronize(row.user.id, data.semester);
    } catch {
      console.error("semester_sync_failed");
    }
  });
  return json({ ok: true });
});
export const DELETE = endpoint(async (req) => {
  const row = await session(req, true);
  z.object({ confirm: z.literal("DELETE") }).parse(await body(req));
  await database().delete(users).where(eq(users.id, row.user.id));
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
});
