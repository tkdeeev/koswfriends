import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { after } from "next/server";
import { database } from "@/server/db";
import { attempts, connections, sessions, users } from "@/server/schema";
import { config } from "@/server/config";
import { exchangeToken } from "@/server/oauth";
import {
  AppError,
  encrypt,
  hash,
  randomToken,
  safeCode,
} from "@/server/security";
import {
  cookieOptions,
  endpoint,
  NO_STORE,
  SESSION_COOKIE,
} from "@/server/http";
import { currentSemester } from "@/lib/calendar";
import { synchronize } from "@/server/sync";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const cfg = config();
  const response = NextResponse.redirect(new URL("/", cfg.appUrl), {
    headers: NO_STORE,
  });
  response.cookies.set("kwf_oauth", "", { ...cookieOptions(), maxAge: 0 });
  try {
    const state = req.nextUrl.searchParams.get("state") || "";
    const browser = req.cookies.get("kwf_oauth")?.value || "";
    if (!state || !browser) throw new AppError("invalid_state");
    const [attempt] = await database()
      .delete(attempts)
      .where(
        and(
          eq(attempts.hash, hash(state)),
          eq(attempts.browserHash, hash(browser)),
          gt(attempts.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!attempt) throw new AppError("invalid_state");
    if (req.nextUrl.searchParams.has("error"))
      throw new AppError("consent_denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096) throw new AppError("invalid_state");
    const token = await exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    });
    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const user = await database().transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          username: token.username,
          name: token.username,
          semester: currentSemester(),
        })
        .onConflictDoUpdate({
          target: users.username,
          set: { activeAt: new Date() },
        })
        .returning();
      const values = {
        userId: user.id,
        access: encrypt(token.access_token),
        refresh: token.refresh_token ? encrypt(token.refresh_token) : null,
        expiresAt: token.expiresAt,
        reconnect: false,
      };
      await tx
        .insert(connections)
        .values(values)
        .onConflictDoUpdate({ target: connections.userId, set: values });
      await tx
        .insert(sessions)
        .values({
          hash: hash(sessionToken),
          userId: user.id,
          csrf: randomToken(),
          expiresAt,
        });
      return user;
    });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      ...cookieOptions(),
      expires: expiresAt,
    });
    response.headers.set(
      "Location",
      new URL(attempt.returnTo, cfg.appUrl).toString(),
    );
    after(async () => {
      try {
        await synchronize(user.id, user.semester);
      } catch {
        console.error("initial_sync_failed");
      }
    });
  } catch (e) {
    response.headers.set(
      "Location",
      new URL(`/?authError=${safeCode(e)}`, cfg.appUrl).toString(),
    );
  }
  return response;
});
