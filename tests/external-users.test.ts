import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { database, closeDatabase } from "../src/server/db";
import * as tables from "../src/server/schema";
import { decrypt, encrypt, hash, AppError } from "../src/server/security";
import { externalUser, externalUsername } from "../src/server/external-auth";
import { fetchIcs } from "../src/server/feed-fetch";
import { synchronizeFeeds } from "../src/server/feeds";
import { synchronize } from "../src/server/sync";
import { semesterWindow, currentSemester } from "../src/lib/calendar";
import { GET as login } from "../src/app/auth/login/route";
import { GET as googleCallback } from "../src/app/auth/callback/google/route";
import { GET as discordCallback } from "../src/app/auth/callback/discord/route";
import { GET as schoolCallback } from "../src/app/callback/route";
import { GET as getMe, DELETE as deleteMe } from "../src/app/api/me/route";
import {
  GET as getFeeds,
  POST as addFeed,
  DELETE as removeFeed,
} from "../src/app/api/feeds/route";
import { GET as calendar } from "../src/app/api/calendar/route";
import { GET as people } from "../src/app/api/people/route";
import {
  GET as friendList,
  PATCH as changeFriend,
} from "../src/app/api/friends/route";
import {
  GET as getGroups,
  POST as createGroup,
  PATCH as changeGroup,
} from "../src/app/api/groups/route";
import { GET as exportMe } from "../src/app/api/me/export/route";
import { requestFriend } from "../src/server/friends";
vi.mock("../src/server/feed-fetch", async (original) => ({
  ...(await original<typeof import("../src/server/feed-fetch")>()),
  fetchIcs: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
if (process.env.KWF_TEST_DATABASE !== "yes")
  throw new Error("Synthetic database required");
const semester = currentSemester();
const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-only\r\nDTSTART:20261020T090000Z\r\nDTEND:20261020T100000Z\r\nSUMMARY:External university class\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const giving = { calendar: true, plans: false };
async function user(name: string, external = true) {
  const [row] = await database()
    .insert(tables.users)
    .values({
      username: name,
      name,
      accountType: external ? "external" : "cvut",
      semester,
    })
    .returning();
  const token = `synthetic-${name}`,
    csrf = `csrf-${name}`;
  await database()
    .insert(tables.sessions)
    .values({
      hash: hash(token),
      csrf,
      userId: row.id,
      expiresAt: new Date(Date.now() + 3600000),
    });
  return { ...row, token, csrf };
}
type User = Awaited<ReturnType<typeof user>>;
function req(user: User, path: string, method = "GET", data?: unknown) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method,
    headers: {
      Cookie: `kwf_session=${user.token}`,
      Origin: "http://localhost:3100",
      "X-CSRF-Token": user.csrf,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await database().delete(tables.users);
  await database().delete(tables.attempts);
  vi.mocked(fetchIcs).mockResolvedValue(ics);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await closeDatabase();
});
function configure() {
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "synthetic-google");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv("DISCORD_OAUTH_CLIENT_ID", "synthetic-discord");
  vi.stubEnv("DISCORD_OAUTH_CLIENT_SECRET", "synthetic-secret");
}
it("generates unique nine-letter name-based usernames under concurrent sign-ins and keeps provider identities separate", async () => {
  for (const name of [
    "Tomáš Kubíček",
    "A",
    "123",
    "王小明",
    "Very Long Display Name",
  ])
    expect(externalUsername(name)).toMatch(/^[a-z]{9}$/);
  expect(externalUsername("Tomáš Kubíček")).toBe("tomaskubi");
  const first = await database().transaction((tx) =>
    externalUser(tx, "google", "123", "Alexandra Smith"),
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      database().transaction((tx) =>
        externalUser(tx, "google", "123", "Alexandra Updated"),
      ),
    ),
  );
  expect(new Set(results.map((r) => r.id))).toEqual(new Set([first.id]));
  const other = await database().transaction((tx) =>
    externalUser(tx, "discord", "123", "Alexandra Smith"),
  );
  expect(other.id).not.toBe(first.id);
  expect(other.username).toMatch(/^[a-z]{9}$/);
  expect(other.username).not.toBe(first.username);
  expect(first.accountType).toBe("external");
});
it("uses minimal scopes, Google PKCE and provider-bound single-use browser state; preserves invitations", async () => {
  configure();
  const start = await login(
    new NextRequest(
      `http://localhost:3100/auth/login?provider=google&invite=${"a".repeat(43)}`,
    ),
  );
  const url = new URL(start.headers.get("location")!);
  expect(url.searchParams.get("scope")).toBe("openid profile");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://localhost:3100/auth/callback/google",
  );
  const state = url.searchParams.get("state")!,
    cookie = start.headers.get("set-cookie")!.split(";")[0];
  const [attempt] = await database()
    .select()
    .from(tables.attempts)
    .where(eq(tables.attempts.hash, hash(state)));
  expect(
    Buffer.from(hash(attempt.verifier!), "hex").toString("base64url"),
  ).toBe(url.searchParams.get("code_challenge"));
  const wrongBrowser = await googleCallback(
    new NextRequest(
      `http://localhost:3100/auth/callback/google?state=${state}&code=fake`,
      { headers: { Cookie: "kwf_oauth_google=wrong" } },
    ),
  );
  expect(wrongBrowser.headers.get("location")).toContain("invalid_state");
  const wrongProvider = await schoolCallback(
    new NextRequest(`http://localhost:3100/callback?state=${state}&code=fake`, {
      headers: { Cookie: cookie.replace("kwf_oauth_google", "kwf_oauth") },
    }),
  );
  expect(wrongProvider.headers.get("location")).toContain("invalid_state");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/token")) {
        expect(
          new URLSearchParams(init.body as URLSearchParams).get(
            "code_verifier",
          ),
        ).toBe(attempt.verifier);
        return Response.json({
          access_token: "synthetic-access",
          token_type: "Bearer",
        });
      }
      return Response.json({ sub: "123456789", name: "Alexandra Smith" });
    }),
  );
  const response = await googleCallback(
    new NextRequest(
      `http://localhost:3100/auth/callback/google?state=${state}&code=fake`,
      { headers: { Cookie: cookie } },
    ),
  );
  expect(response.headers.get("location")).toContain(
    `/?invite=${"a".repeat(43)}`,
  );
  expect(response.headers.get("set-cookie")).toContain("kwf_session=");
  const replay = await googleCallback(
    new NextRequest(
      `http://localhost:3100/auth/callback/google?state=${state}&code=fake`,
      { headers: { Cookie: cookie } },
    ),
  );
  expect(replay.headers.get("location")).toContain("invalid_state");
  expect(await database().select().from(tables.connections)).toHaveLength(0);
  expect(
    JSON.stringify(await database().select().from(tables.identities)),
  ).not.toContain("synthetic-access");
});
it("supports Discord display names and denied/unconfigured logins without creating users", async () => {
  configure();
  const start = await login(
    new NextRequest("http://localhost:3100/auth/login?provider=discord"),
  );
  const url = new URL(start.headers.get("location")!);
  expect(url.searchParams.get("scope")).toBe("identify");
  const state = url.searchParams.get("state")!,
    cookie = start.headers.get("set-cookie")!.split(";")[0];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("/token")
          ? { access_token: "synthetic-access", token_type: "Bearer" }
          : { id: "99999", username: "alex", global_name: "Alexandra Smith" },
      ),
    ),
  );
  const response = await discordCallback(
    new NextRequest(
      `http://localhost:3100/auth/callback/discord?state=${state}&code=fake`,
      { headers: { Cookie: cookie } },
    ),
  );
  expect(response.headers.get("set-cookie")).toContain("kwf_session=");
  expect((await database().select().from(tables.users))[0].name).toBe(
    "Alexandra Smith",
  );
  const deniedStart = await login(
    new NextRequest("http://localhost:3100/auth/login?provider=discord"),
  );
  const deniedState = new URL(
    deniedStart.headers.get("location")!,
  ).searchParams.get("state");
  expect(
    (
      await discordCallback(
        new NextRequest(
          `http://localhost:3100/auth/callback/discord?state=${deniedState}&error=access_denied`,
          {
            headers: {
              Cookie: deniedStart.headers.get("set-cookie")!.split(";")[0],
            },
          },
        ),
      )
    ).headers.get("location"),
  ).toContain("consent_denied");
  vi.stubEnv("DISCORD_OAUTH_CLIENT_SECRET", "");
  expect(
    (
      await login(
        new NextRequest("http://localhost:3100/auth/login?provider=discord"),
      )
    ).headers.get("location"),
  ).toContain("login_unconfigured");
  expect(await database().select().from(tables.users)).toHaveLength(1);
});
it("school sign-in cannot overwrite an external account on a username conflict", async () => {
  const external = await user("alexandra");
  const start = await login(
    new NextRequest("http://localhost:3100/auth/login"),
  );
  const state = new URL(start.headers.get("location")!).searchParams.get(
    "state",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("check_token")
          ? {
              client_id: "synthetic-client",
              user_name: external.username,
              exp: Math.floor(Date.now() / 1000) + 3600,
              scope: ["cvut:sirius:personal:read"],
            }
          : { access_token: "synthetic-access" },
      ),
    ),
  );
  const response = await schoolCallback(
    new NextRequest(`http://localhost:3100/callback?state=${state}&code=fake`, {
      headers: { Cookie: start.headers.get("set-cookie")!.split(";")[0] },
    }),
  );
  expect(response.headers.get("location")).toContain("identity_conflict");
  expect(await database().select().from(tables.connections)).toHaveLength(0);
});
it("imports feeds for both account types, enforces ownership/CSRF, hides URLs and preserves school snapshots", async () => {
  const a = await user("alexandra"),
    b = await user("schoolab", false);
  expect(await (await getMe(req(a, "/api/me"))).json()).toMatchObject({
    accountType: "external",
    reconnect: false,
  });
  expect(await synchronize(a.id, semester, true)).toMatchObject({ ok: true });
  const privateUrl =
    "https://university.example/private-feed?token=synthetic-secret";
  const response = await addFeed(
    req(a, "/api/feeds", "POST", { name: "Other university", url: privateUrl }),
  );
  expect(response.status).toBe(200);
  const { id } = await response.json();
  const [stored] = await database().select().from(tables.calendarFeeds);
  expect(stored.url).not.toContain("synthetic-secret");
  expect(decrypt(stored.url)).toBe(privateUrl);
  expect(
    JSON.stringify(await (await getFeeds(req(a, "/api/feeds"))).json()),
  ).not.toContain("token");
  expect(
    (await removeFeed(req(b, "/api/feeds", "DELETE", { id }))).status,
  ).toBe(404);
  expect(
    (
      await addFeed(
        new NextRequest("http://localhost:3100/api/feeds", {
          method: "POST",
          headers: {
            Cookie: `kwf_session=${a.token}`,
            Origin: "https://attacker.example",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "x", url: privateUrl }),
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await addFeed(
        req(b, "/api/feeds", "POST", { name: "Additional", url: privateUrl }),
      )
    ).status,
  ).toBe(200);
  await database()
    .insert(tables.snapshots)
    .values({
      userId: b.id,
      semester,
      events: [],
      window: semesterWindow(semester),
      lastSuccess: new Date(),
    });
  expect(
    (await (await calendar(req(a, "/api/calendar"))).json()).calendars[0]
      .events,
  ).toHaveLength(1);
  const exported = await (await exportMe(req(a, "/api/me/export"))).json();
  expect(exported.importedFeeds[0].events).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain("synthetic-secret");
  await removeFeed(req(a, "/api/feeds", "DELETE", { id }));
  expect(
    (await (await calendar(req(a, "/api/calendar"))).json()).calendars[0]
      .events,
  ).toHaveLength(0);
  expect(await database().select().from(tables.snapshots)).toHaveLength(1);
});
it("keeps the last successful feed when refresh fails, limits failed submissions, deduplicates and caps subscriptions", async () => {
  const a = await user("alexandra");
  const input = { name: "Campus", url: "https://university.example/feed" };
  const { id } = await (
    await addFeed(req(a, "/api/feeds", "POST", input))
  ).json();
  expect(await synchronizeFeeds(a.id, "B252", true)).toMatchObject({
    ok: false,
    error: "sync_cooldown",
  });
  expect(await synchronizeFeeds(a.id, "B252")).toMatchObject({
    ok: true,
    count: 0,
  });
  expect(fetchIcs).toHaveBeenCalledTimes(1);
  await database()
    .update(tables.feedSnapshots)
    .set({ lastAttempt: new Date(0) });
  await database()
    .update(tables.users)
    .set({ feedAttemptAt: new Date(0) });
  vi.mocked(fetchIcs).mockRejectedValue(new AppError("ics_unavailable"));
  expect(await synchronizeFeeds(a.id, semester, true)).toMatchObject({
    ok: false,
    error: "ics_unavailable",
  });
  const data = await (await calendar(req(a, "/api/calendar"))).json();
  expect(data.calendars[0].events).toHaveLength(1);
  expect(data.calendars[0].error).toBe("ics_unavailable");
  await database()
    .update(tables.users)
    .set({ feedAttemptAt: new Date(0) });
  expect((await addFeed(req(a, "/api/feeds", "POST", input))).status).toBe(400);
  expect(
    (
      await addFeed(
        req(a, "/api/feeds", "POST", { ...input, url: input.url + "2" }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await addFeed(
        req(a, "/api/feeds", "POST", { ...input, url: input.url + "3" }),
      )
    ).status,
  ).toBe(429);
  await database()
    .update(tables.users)
    .set({ feedAttemptAt: new Date(0) });
  vi.mocked(fetchIcs).mockResolvedValue(ics);
  for (let i = 0; i < 4; i++)
    await database()
      .insert(tables.calendarFeeds)
      .values({
        userId: a.id,
        name: "Extra",
        url: encrypt(input.url + i),
        urlHash: hash(input.url + i),
      });
  expect(
    (
      await addFeed(
        req(a, "/api/feeds", "POST", { ...input, url: input.url + "6" }),
      )
    ).status,
  ).toBe(400);
  await database()
    .insert(tables.identities)
    .values({ userId: a.id, provider: "google", subject: "123" });
  await deleteMe(req(a, "/api/me", "DELETE", { confirm: "DELETE" }));
  expect(await database().select().from(tables.calendarFeeds)).toEqual([]);
  expect(await database().select().from(tables.feedSnapshots)).toEqual([]);
  expect(await database().select().from(tables.identities)).toEqual([]);
});
it("external users join school users' friends and groups with the same directional sharing and immediate revocation", async () => {
  const a = await user("schoolab", false),
    b = await user("alexandra"),
    stranger = await user("strangera");
  await addFeed(
    req(b, "/api/feeds", "POST", {
      name: "University",
      url: "https://university.example/feed",
    }),
  );
  await requestFriend(a.id, b.id, giving);
  await changeFriend(
    req(b, "/api/friends", "PATCH", { id: a.id, action: "accept", giving }),
  );
  expect(
    (await (await friendList(req(a, "/api/friends"))).json()).friends[0],
  ).toMatchObject({ accountType: "external", username: b.username });
  const view = () => calendar(req(a, `/api/calendar?friends=${b.id}`));
  expect((await (await view()).json()).calendars[1].events).toHaveLength(1);
  expect(
    (await (await people(req(a, `/api/people?id=${b.id}`))).json()).people[0]
      .person.accountType,
  ).toBe("external");
  expect(
    (
      await (
        await calendar(req(stranger, `/api/calendar?friends=${b.id}`))
      ).json()
    ).calendars,
  ).toHaveLength(1);
  await changeFriend(
    req(b, "/api/friends", "PATCH", { id: a.id, action: "remove" }),
  );
  expect((await (await view()).json()).calendars).toHaveLength(1);
  const { id } = await (
    await createGroup(
      req(a, "/api/groups", "POST", { name: "Mixed universities", giving }),
    )
  ).json();
  await changeGroup(
    req(a, "/api/groups", "PATCH", {
      id,
      action: "invite",
      username: b.username,
    }),
  );
  await changeGroup(
    req(b, "/api/groups", "PATCH", { id, action: "accept", giving }),
  );
  const roster = await (await getGroups(req(a, "/api/groups"))).json();
  expect(
    roster.groups[0].members.find((m: { id: string }) => m.id === b.id)
      .accountType,
  ).toBe("external");
  expect((await (await view()).json()).calendars).toHaveLength(2);
  await changeGroup(req(b, "/api/groups", "PATCH", { id, action: "leave" }));
  expect((await (await view()).json()).calendars).toHaveLength(1);
});
