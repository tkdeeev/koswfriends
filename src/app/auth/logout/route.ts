import { eq } from "drizzle-orm";
import { database } from "@/server/db";
import { sessions } from "@/server/schema";
import {
  cookieOptions,
  endpoint,
  json,
  session,
  SESSION_COOKIE,
} from "@/server/http";
export const POST = endpoint(async (req) => {
  const row = await session(req, true);
  await database().delete(sessions).where(eq(sessions.hash, row.session.hash));
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
});
