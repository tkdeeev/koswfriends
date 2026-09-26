import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CHOICE_TTL,
  analyticsOptOut,
  readAnalyticsChoice,
} from "../src/lib/analytics";
import { analyticsConfiguration, collectUsage } from "../src/server/analytics";

const website = "6922fa17-a6b5-4de4-9cc5-46c991bb2b1e";
const headers = {
  origin: "https://kos.deeev.cz",
  "content-type": "application/json",
  "x-analytics-consent": "1",
  "sec-fetch-site": "same-origin",
};
function request(
  body: unknown = { page: "timetable" },
  changes: Record<string, string> = {},
) {
  return new Request("https://kos.deeev.cz/api/usage", {
    method: "POST",
    headers: { ...headers, ...changes },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_URL", "https://kos.deeev.cz");
  vi.stubEnv("UMAMI_ENABLED", "true");
  vi.stubEnv("UMAMI_URL", "https://analytics.example.test");
  vi.stubEnv("UMAMI_WEBSITE_ID", website);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response('{"cache":"private-umami-token"}')),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("optional aggregate analytics", () => {
  it("only accepts a current, explicit choice and expires it equally for both decisions", () => {
    const now = 100000000000;
    for (const choice of ["accepted", "declined"]) {
      expect(
        readAnalyticsChoice(
          JSON.stringify({ version: 1, choice, savedAt: now }),
          now,
        ),
      ).toBe(choice);
      expect(
        readAnalyticsChoice(
          JSON.stringify({
            version: 1,
            choice,
            savedAt: now - ANALYTICS_CHOICE_TTL,
          }),
          now,
        ),
      ).toBeNull();
    }
    expect(readAnalyticsChoice('{"choice":"accepted"}', now)).toBeNull();
    expect(
      readAnalyticsChoice(
        JSON.stringify({ version: 1, choice: "accepted", savedAt: now + 1 }),
        now,
      ),
    ).toBeNull();
    expect(readAnalyticsChoice("broken")).toBeNull();
    expect(analyticsOptOut({ globalPrivacyControl: true })).toBe(true);
    expect(analyticsOptOut({ doNotTrack: "1" })).toBe(true);
    expect(analyticsOptOut({ doNotTrack: "0" })).toBe(false);
  });
  it("keeps analytics disabled until all explicit server configuration is valid", async () => {
    vi.stubEnv("UMAMI_ENABLED", "false");
    expect(analyticsConfiguration()).toBeNull();
    expect((await collectUsage(request())).status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("UMAMI_ENABLED", "true");
    vi.stubEnv("UMAMI_WEBSITE_ID", "wrong");
    expect(analyticsConfiguration()).toBeNull();
    vi.stubEnv("UMAMI_WEBSITE_ID", website);
    vi.stubEnv("UMAMI_URL", "https://user:secret@example.test");
    expect(analyticsConfiguration()).toBeNull();
  });
  it("rejects missing consent, foreign origins, private fields and oversized bodies", async () => {
    for (const [body, change, status] of [
      [{ page: "home" }, { "x-analytics-consent": "" }, 403],
      [{ page: "home" }, { origin: "https://foreign.test" }, 403],
      [{ page: "home" }, { "sec-fetch-site": "cross-site" }, 403],
      [{ page: "home", user: "student" }, {}, 400],
      [{ page: "/?invite=secret" }, {}, 400],
      [{ page: "connections#groupInvite=secret" }, {}, 400],
      ["x".repeat(257), {}, 400],
    ] as const)
      expect((await collectUsage(request(body, change))).status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("honors DNT and GPC on the server even if a browser sends a consent header", async () => {
    await collectUsage(request(undefined, { dnt: "1" }));
    await collectUsage(request(undefined, { "sec-gpc": "1" }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rebuilds the payload and never relays browser secrets, tracking IDs or headers", async () => {
    const response = await collectUsage(
      request(undefined, {
        cookie: "kwf_session=private",
        authorization: "Bearer private",
        "user-agent": "private-browser",
        "x-forwarded-for": "198.51.100.29",
        referer: "https://kos.deeev.cz/?invite=secret",
      }),
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("set-cookie")).toBeNull();
    const [target, init] = vi.mocked(fetch).mock.calls[0];
    expect(target).toBe("https://analytics.example.test/api/send");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(init?.body as string)).toEqual({
      type: "event",
      payload: {
        website,
        hostname: "kos.deeev.cz",
        url: "/timetable",
        title: "timetable",
        ip: "127.0.0.1",
        userAgent: "KOSwFriends aggregate page counter",
        browser: "",
        os: "",
        device: "",
      },
    });
  });
  it("tolerates analytics being unavailable without breaking the application", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("unavailable"));
    expect((await collectUsage(request())).status).toBe(204);
  });
});
