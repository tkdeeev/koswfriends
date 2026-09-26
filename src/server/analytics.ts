import {
  analyticsPages,
  ANALYTICS_CHOICE_VERSION,
  type AnalyticsPage,
} from "@/lib/analytics";

const NO_STORE = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};
const MAX_BODY = 256;

export function analyticsConfiguration() {
  if (process.env.UMAMI_ENABLED !== "true") return null;
  const website = process.env.UMAMI_WEBSITE_ID || "";
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      website,
    )
  )
    return null;
  try {
    const origin = new URL(process.env.APP_URL || "").origin;
    const upstream = new URL(process.env.UMAMI_URL || "");
    if (
      !/^https?:$/.test(upstream.protocol) ||
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash ||
      upstream.pathname !== "/"
    )
      return null;
    return { origin, website, endpoint: new URL("/api/send", upstream).href };
  } catch {
    return null;
  }
}

export function analyticsPayload(page: AnalyticsPage, website: string) {
  // Only this fixed aggregate category crosses into Umami. The visitor's URL,
  // identity, network headers and browser characteristics are never forwarded.
  return {
    type: "event",
    payload: {
      website,
      hostname: "kos.deeev.cz",
      url: `/${page}`,
      title: page,
      ip: "127.0.0.1",
      userAgent: "KOSwFriends aggregate page counter",
      browser: "",
      os: "",
      device: "",
    },
  };
}

function empty(status = 204) {
  return new Response(null, { status, headers: NO_STORE });
}

async function readPage(request: Request): Promise<AnalyticsPage | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let length = 0;
  let raw = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const input = JSON.parse(raw);
    if (
      !input ||
      Object.keys(input).length !== 1 ||
      !analyticsPages.includes(input.page)
    )
      return null;
    return input.page;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function collectUsage(request: Request) {
  const config = analyticsConfiguration();
  if (
    !config ||
    request.headers.get("dnt") === "1" ||
    request.headers.get("sec-gpc") === "1"
  )
    return empty();
  if (
    request.headers.get("origin") !== config.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return empty(403);
  if (
    request.headers.get("x-analytics-consent") !==
    String(ANALYTICS_CHOICE_VERSION)
  )
    return empty(403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return empty(415);
  const page = await readPage(request);
  if (!page) return empty(400);
  try {
    const result = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyticsPayload(page, config.website)),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    // Do not send Umami's session token or tracking identifiers to the browser.
    await result.body?.cancel();
  } catch {
    /* Optional statistics must never interrupt the timetable. */
  }
  return empty();
}
