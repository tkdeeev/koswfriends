import { NextRequest, NextResponse } from "next/server";
import { config } from "@/server/config";
import { database } from "@/server/db";
import { attempts } from "@/server/schema";
import { hash, randomToken } from "@/server/security";
import { cookieOptions, endpoint, NO_STORE } from "@/server/http";
import { externalConfig, externalProvider } from "@/server/external-auth";
import { appUrl } from "@/server/config";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req: NextRequest) => {
  const requested = req.nextUrl.searchParams.get("provider");
  const provider = requested ? externalProvider(requested) : "cvut";
  let cfg;
  try {
    cfg = provider === "cvut" ? config() : externalConfig(provider);
  } catch {
    return NextResponse.redirect(
      new URL("/?authError=login_unconfigured", appUrl()),
      { headers: NO_STORE },
    );
  }
  const verifier = provider === "google" ? randomToken() : null;
  const state = randomToken();
  const browser = randomToken();
  const invite = req.nextUrl.searchParams.get("invite");
  const returnParams = new URLSearchParams();
  if (invite && /^[A-Za-z0-9_-]{43}$/.test(invite))
    returnParams.set("invite", invite);
  if (req.nextUrl.searchParams.get("view") === "planner")
    returnParams.set("view", "planner");
  const returnTo = returnParams.size ? `/?${returnParams}` : "/";
  await database()
    .insert(attempts)
    .values({
      hash: hash(state),
      browserHash: hash(browser),
      expiresAt: new Date(Date.now() + 10 * 60000),
      returnTo,
      provider,
      verifier,
    });
  const url = new URL(cfg.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scope,
    state,
  }).toString();
  if (verifier) {
    url.searchParams.set(
      "code_challenge",
      Buffer.from(hash(verifier), "hex").toString("base64url"),
    );
    url.searchParams.set("code_challenge_method", "S256");
  }
  const response = NextResponse.redirect(url, { headers: NO_STORE });
  response.cookies.set(
    provider === "cvut" ? "kwf_oauth" : `kwf_oauth_${provider}`,
    browser,
    {
      ...cookieOptions(),
      maxAge: 600,
    },
  );
  return response;
});
