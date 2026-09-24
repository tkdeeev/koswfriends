import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { ZodError } from "zod";
import { database } from "./db";
import { sessions, users } from "./schema";
import { AppError, equal, hash } from "./security";
export const SESSION_COOKIE = "kwf_session";
export const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "CDN-Cache-Control": "no-store",
};
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://") ?? true,
    sameSite: "lax" as const,
    path: "/",
  };
}
export async function session(req: NextRequest, mutate = false) {
  const value = req.cookies.get(SESSION_COOKIE)?.value;
  if (!value) throw new AppError("unauthorized", 401);
  const [row] = await database()
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.hash, hash(value)), gt(sessions.expiresAt, new Date())),
    );
  if (!row) throw new AppError("unauthorized", 401);
  if (mutate) {
    if (
      req.headers.get("origin") !== new URL(process.env.APP_URL!).origin ||
      !equal(req.headers.get("x-csrf-token") || "", row.session.csrf)
    )
      throw new AppError("csrf", 403);
  }
  if (Date.now() - row.user.activeAt.getTime() > 60000)
    await database()
      .update(users)
      .set({ activeAt: new Date() })
      .where(eq(users.id, row.user.id));
  return row;
}
export async function body(req: NextRequest) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("invalid_request");
  const raw = await req.text();
  if (raw.length > 16384) throw new AppError("too_large", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError("invalid_request");
  }
}
export function endpoint(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof ZodError) return json({ error: "invalid_request" }, 400);
      if (e instanceof AppError) return json({ error: e.code }, e.status);
      // Never log provider errors, SQL parameters, or request bodies.
      console.error("request_failed");
      return json({ error: "unavailable" }, 500);
    }
  };
}
