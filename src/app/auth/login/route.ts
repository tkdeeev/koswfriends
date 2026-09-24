import { NextRequest, NextResponse } from "next/server";
import { config } from "@/server/config";
import { database } from "@/server/db";
import { attempts } from "@/server/schema";
import { hash, randomToken } from "@/server/security";
import { cookieOptions, endpoint, NO_STORE } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req: NextRequest) => {
  const cfg = config();
  const state = randomToken();
  const browser = randomToken();
  const invite = req.nextUrl.searchParams.get("invite");
  const returnTo =
    invite && /^[A-Za-z0-9_-]{43}$/.test(invite) ? `/?invite=${invite}` : "/";
  await database()
    .insert(attempts)
    .values({
      hash: hash(state),
      browserHash: hash(browser),
      expiresAt: new Date(Date.now() + 10 * 60000),
      returnTo,
    });
  const url = new URL(cfg.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scope,
    state,
  }).toString();
  const response = NextResponse.redirect(url, { headers: NO_STORE });
  response.cookies.set("kwf_oauth", browser, {
    ...cookieOptions(),
    maxAge: 600,
  });
  return response;
});
