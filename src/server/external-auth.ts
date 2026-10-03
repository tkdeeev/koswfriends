import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { database, type TX } from "./db";
import { attempts, identities, sessions, users } from "./schema";
import { appUrl } from "./config";
import { providerJson } from "./oauth";
import { AppError, hash, randomToken, safeCode } from "./security";
import { cookieOptions, NO_STORE, SESSION_COOKIE } from "./http";
import { currentSemester } from "../lib/calendar";
import { externalUsername } from "./username";
export { externalUsername } from "./username";

export type ExternalProvider = "google" | "discord";
export function externalProvider(value: string): ExternalProvider {
  if (value !== "google" && value !== "discord")
    throw new AppError("invalid_request");
  return value;
}
export function externalConfig(provider: ExternalProvider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_OAUTH_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_OAUTH_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new AppError("login_unconfigured", 503);
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl()}/auth/callback/${provider}`,
    authorizeUrl:
      provider === "google"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://discord.com/oauth2/authorize",
    tokenUrl:
      provider === "google"
        ? "https://oauth2.googleapis.com/token"
        : "https://discord.com/api/v10/oauth2/token",
    profileUrl:
      provider === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : "https://discord.com/api/v10/users/@me",
    scope: provider === "google" ? "openid profile" : "identify",
  };
}
export async function externalUser(
  tx: TX,
  provider: ExternalProvider,
  subject: string,
  name: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`identity:${provider}:${subject}`}))`,
  );
  const [identity] = await tx
    .select()
    .from(identities)
    .where(
      and(eq(identities.provider, provider), eq(identities.subject, subject)),
    );
  if (identity) {
    const [user] = await tx
      .update(users)
      .set({ name, activeAt: new Date() })
      .where(eq(users.id, identity.userId))
      .returning();
    return user;
  }
  for (let i = 0; i < 20; i++) {
    const [user] = await tx
      .insert(users)
      .values({
        username: externalUsername(name, i > 0),
        name,
        semester: currentSemester(),
        accountType: "external",
      })
      .onConflictDoNothing({ target: users.username })
      .returning();
    if (!user) continue;
    await tx.insert(identities).values({ provider, subject, userId: user.id });
    return user;
  }
  throw new AppError("unavailable", 503);
}
export async function externalIdentity(
  provider: ExternalProvider,
  code: string,
  verifier: string | null,
) {
  const cfg = externalConfig(provider);
  const token = z
    .object({
      access_token: z.string().min(1).max(8192),
      token_type: z.string(),
    })
    .safeParse(
      await providerJson(cfg.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          ...(provider === "google" && verifier
            ? { code_verifier: verifier }
            : {}),
        }),
      }),
    );
  if (!token.success || token.data.token_type.toLowerCase() !== "bearer")
    throw new AppError("invalid_identity", 502);
  const profile = await providerJson(cfg.profileUrl, {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
  });
  const parsed =
    provider === "google"
      ? z
          .object({
            sub: z.string().regex(/^\d{1,255}$/),
            name: z.string().trim().min(1).max(200),
          })
          .safeParse(profile)
      : z
          .object({
            id: z.string().regex(/^\d{1,30}$/),
            username: z.string().trim().min(1).max(200),
            global_name: z.string().trim().max(200).nullable().optional(),
            bot: z.boolean().optional(),
          })
          .safeParse(profile);
  if (!parsed.success) throw new AppError("invalid_identity", 502);
  const data = parsed.data;
  if ("sub" in data) return { subject: data.sub, name: data.name };
  if (data.bot) throw new AppError("invalid_identity", 502);
  return { subject: data.id, name: data.global_name || data.username };
}
export async function externalCallback(
  req: NextRequest,
  provider: ExternalProvider,
) {
  const response = NextResponse.redirect(new URL("/", appUrl()), {
    headers: NO_STORE,
  });
  const cookie = `kwf_oauth_${provider}`;
  response.cookies.set(cookie, "", { ...cookieOptions(), maxAge: 0 });
  try {
    const state = req.nextUrl.searchParams.get("state") || "";
    const browser = req.cookies.get(cookie)?.value || "";
    if (!state || state.length > 100 || !browser)
      throw new AppError("invalid_state");
    const [attempt] = await database()
      .delete(attempts)
      .where(
        and(
          eq(attempts.hash, hash(state)),
          eq(attempts.browserHash, hash(browser)),
          eq(attempts.provider, provider),
          gt(attempts.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!attempt) throw new AppError("invalid_state");
    if (req.nextUrl.searchParams.has("error"))
      throw new AppError("consent_denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096) throw new AppError("invalid_state");
    const identity = await externalIdentity(provider, code, attempt.verifier);
    const sessionToken = randomToken(),
      expiresAt = new Date(Date.now() + 30 * 86400000);
    await database().transaction(async (tx) => {
      const user = await externalUser(
        tx,
        provider,
        identity.subject,
        identity.name,
      );
      await tx
        .insert(sessions)
        .values({
          hash: hash(sessionToken),
          userId: user.id,
          csrf: randomToken(),
          expiresAt,
        });
    });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      ...cookieOptions(),
      expires: expiresAt,
    });
    response.headers.set(
      "Location",
      new URL(attempt.returnTo, appUrl()).toString(),
    );
  } catch (error) {
    response.headers.set(
      "Location",
      new URL(`/?authError=${safeCode(error)}`, appUrl()).toString(),
    );
  }
  return response;
}
