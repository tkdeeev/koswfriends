import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { database, closeDatabase } from "../src/server/db";
import * as tables from "../src/server/schema";
import { encrypt, decrypt, hash } from "../src/server/security";
import { accessToken, validateToken } from "../src/server/oauth";
import { requestFriend, pair } from "../src/server/friends";
import { synchronize } from "../src/server/sync";
import { fetchEvents, normalizePage } from "../src/server/sirius";
import { semesterWindow } from "../src/lib/calendar";
import { GET as calendar } from "../src/app/api/calendar/route";
import { GET as plans, POST as savePlan } from "../src/app/api/plans/route";
import {
  PATCH as changeFriend,
  POST as addFriend,
} from "../src/app/api/friends/route";
import {
  POST as invite,
  DELETE as revokeInvite,
} from "../src/app/api/invites/route";
import { DELETE as deleteMe } from "../src/app/api/me/route";
import { GET as login } from "../src/app/auth/login/route";
import { GET as callback } from "../src/app/callback/route";
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
if (
  process.env.KWF_TEST_DATABASE !== "yes" ||
  !process.env.DATABASE_URL?.endsWith("/koswfriends_test")
)
  throw new Error("Tests require an isolated test database");
const semester = "B261";
const raw = (id: number) => ({
  id,
  starts_at: "2026-10-20T09:00:00+02:00",
  ends_at: "2026-10-20T10:30:00+02:00",
  parallel: "101",
  event_type: "tutorial",
  deleted: false,
  links: { course: "TEST-MAT", room: "TEST-1" },
});
const lesson = normalizePage({ events: [raw(1)] }).events[0];
const permission = { calendar: true, plans: false };
async function user(username: string) {
  const [u] = await database()
    .insert(tables.users)
    .values({ username, name: username, semester })
    .returning();
  const token = `test-session-${username}`;
  const csrf = `test-csrf-${username}`;
  await database()
    .insert(tables.sessions)
    .values({
      userId: u.id,
      hash: hash(token),
      csrf,
      expiresAt: new Date(Date.now() + 3600000),
    });
  await database()
    .insert(tables.connections)
    .values({
      userId: u.id,
      access: encrypt(`test-access-${username}`),
      refresh: encrypt(`test-refresh-${username}`),
      expiresAt: new Date(Date.now() + 3600000),
    });
  return { ...u, token, csrf };
}
type User = Awaited<ReturnType<typeof user>>;
function req(
  u: User,
  path: string,
  method = "GET",
  data?: unknown,
  origin = "http://localhost:3100",
) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method,
    headers: {
      Cookie: `kwf_session=${u.token}`,
      Origin: origin,
      "X-CSRF-Token": u.csrf,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
beforeEach(async () => {
  vi.unstubAllGlobals();
  await database().delete(tables.users);
  await database().delete(tables.attempts);
});
afterAll(closeDatabase);
describe("privacy and database transactions", () => {
  it("denies unauthenticated reads and cross-origin mutations", async () => {
    expect(
      (await calendar(new NextRequest("http://localhost:3100/api/calendar")))
        .status,
    ).toBe(401);
    const a = await user("test-a");
    expect(
      (
        await addFriend(
          req(
            a,
            "/api/friends",
            "POST",
            { username: "test-b", giving: permission },
            "https://attacker.invalid",
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("only shares accepted directional grants, including plan reads and immediate revocation", async () => {
    const a = await user("test-a");
    const b = await user("test-b");
    await database()
      .insert(tables.snapshots)
      .values({
        userId: a.id,
        semester,
        window: semesterWindow(semester),
        events: [lesson],
        lastSuccess: new Date(),
      });
    await database()
      .insert(tables.plans)
      .values({
        userId: a.id,
        semester,
        choices: [
          {
            id: randomUUID(),
            course: "TEST",
            title: { cs: "TEST", en: "TEST" },
            group: null,
            note: "private",
            verified: false,
            events: [],
          },
        ],
      });
    await requestFriend(a.id, b.id, { calendar: true, plans: true });
    const path = `/api/calendar?friends=${a.id}`;
    expect(
      (await (await calendar(req(b, path))).json()).calendars,
    ).toHaveLength(1);
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared,
    ).toHaveLength(0);
    expect(
      (
        await changeFriend(
          req(b, "/api/friends", "PATCH", {
            id: a.id,
            action: "accept",
            giving: { calendar: false, plans: false },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await calendar(req(b, path))).json()).calendars[1].events,
    ).toHaveLength(1);
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared[0].choices[0]
        .note,
    ).toBe("private");
    expect(
      (await (await calendar(req(a, `/api/calendar?friends=${b.id}`))).json())
        .calendars,
    ).toHaveLength(1);
    await changeFriend(
      req(a, "/api/friends", "PATCH", {
        id: b.id,
        action: "sharing",
        giving: { calendar: false, plans: false },
      }),
    );
    const revoked = await (await calendar(req(b, path))).json();
    expect(revoked.calendars).toHaveLength(1);
    expect(revoked.revoked).toEqual([a.id]);
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared,
    ).toHaveLength(0);
    await changeFriend(
      req(a, "/api/friends", "PATCH", { id: b.id, action: "block" }),
    );
    await expect(requestFriend(b.id, a.id, permission)).rejects.toMatchObject({
      code: "request_unavailable",
    });
  });
  it("serializes duplicate requests and rejects self requests", async () => {
    const a = await user("test-a");
    const b = await user("test-b");
    const r = await Promise.allSettled([
      requestFriend(a.id, b.id, permission),
      requestFriend(b.id, a.id, permission),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await database().select().from(tables.friendships)).toHaveLength(1);
    await expect(requestFriend(a.id, a.id, permission)).rejects.toMatchObject({
      code: "self_request",
    });
  });
  it("invitation joins stay pending and expired or revoked links cannot be used", async () => {
    const a = await user("test-a");
    const b = await user("test-b");
    const created = await (
      await invite(
        req(a, "/api/invites", "POST", {
          action: "create",
          giving: permission,
        }),
      )
    ).json();
    const token = new URL(created.url).searchParams.get("invite");
    expect(
      (
        await invite(
          req(b, "/api/invites", "POST", {
            action: "join",
            token,
            giving: permission,
          }),
        )
      ).status,
    ).toBe(200);
    expect((await database().select().from(tables.friendships))[0].status).toBe(
      "pending",
    );
    await revokeInvite(req(a, "/api/invites", "DELETE", { id: created.id }));
    const c = await user("test-c");
    expect(
      (
        await invite(
          req(c, "/api/invites", "POST", {
            action: "join",
            token,
            giving: permission,
          }),
        )
      ).status,
    ).toBe(410);
    const second = await (
      await invite(
        req(a, "/api/invites", "POST", {
          action: "create",
          giving: permission,
        }),
      )
    ).json();
    await database()
      .update(tables.invites)
      .set({ expiresAt: new Date(0) })
      .where(eq(tables.invites.id, second.id));
    expect(
      (
        await invite(
          req(c, "/api/invites", "POST", {
            action: "join",
            token: new URL(second.url).searchParams.get("invite"),
            giving: permission,
          }),
        )
      ).status,
    ).toBe(410);
  });
  it("keeps manual draft choices separate from calendars and deletes owned data", async () => {
    const a = await user("test-a");
    const b = await user("test-b");
    await requestFriend(a.id, b.id, permission);
    const result = await savePlan(
      req(a, "/api/plans", "POST", {
        action: "add",
        semester,
        course: "TEST-CODE",
        note: "Maybe",
      }),
    );
    expect(result.status).toBe(200);
    expect(
      (await (await plans(req(a, "/api/plans"))).json()).choices[0].verified,
    ).toBe(false);
    expect(
      (await (await calendar(req(a, "/api/calendar"))).json()).calendars[0]
        .events,
    ).toEqual([]);
    await deleteMe(req(a, "/api/me", "DELETE", { confirm: "DELETE" }));
    expect(await database().select().from(tables.plans)).toHaveLength(0);
    expect(await database().select().from(tables.friendships)).toHaveLength(0);
    expect(
      await database()
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.userId, a.id)),
    ).toHaveLength(0);
    expect(
      await database()
        .select()
        .from(tables.connections)
        .where(eq(tables.connections.userId, a.id)),
    ).toHaveLength(0);
  });
});
describe("OAuth and encrypted connections", () => {
  it("encrypts with a unique authenticated nonce and detects tampering", () => {
    const one = encrypt("sensitive");
    const two = encrypt("sensitive");
    expect(one).not.toBe(two);
    expect(one).not.toContain("sensitive");
    expect(decrypt(one)).toBe("sensitive");
    const p = one.split(".");
    p[2] = "AAAA";
    expect(() => decrypt(p.join("."))).toThrow();
  });
  it("rejects wrong client, scope, username, and expiry during identity validation", async () => {
    const good = {
      client_id: "synthetic-client",
      user_name: "test-a",
      exp: Math.floor(Date.now() / 1000) + 3600,
      scope: ["cvut:sirius:personal:read"],
    };
    for (const change of [
      { client_id: "other" },
      { user_name: "" },
      { exp: 0 },
      { scope: ["cvut:sirius:all:read"] },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ ...good, ...change })),
      );
      await expect(validateToken("fake")).rejects.toMatchObject({
        code: "invalid_identity",
      });
    }
  });
  it("binds OAuth state to the browser and rejects replay without leaking provider data", async () => {
    const response = await login(
      new NextRequest("http://localhost:3100/auth/login"),
    );
    const state = new URL(response.headers.get("location")!).searchParams.get(
      "state",
    )!;
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    expect(
      new URL(response.headers.get("location")!).searchParams.get("scope"),
    ).toBe("cvut:sirius:personal:read");
    const wrong = await callback(
      new NextRequest(
        `http://localhost:3100/callback?state=${state}&code=fake`,
        { headers: { Cookie: "kwf_oauth=wrong" } },
      ),
    );
    expect(wrong.headers.get("location")).toContain("invalid_state");
    const denied = await callback(
      new NextRequest(
        `http://localhost:3100/callback?state=${state}&error=access_denied`,
        { headers: { Cookie: cookie } },
      ),
    );
    expect(denied.headers.get("location")).toContain("consent_denied");
    const replay = await callback(
      new NextRequest(
        `http://localhost:3100/callback?state=${state}&code=fake`,
        { headers: { Cookie: cookie } },
      ),
    );
    expect(replay.headers.get("location")).toContain("invalid_state");
  });
  it("refreshes exactly once under concurrent requests in PostgreSQL", async () => {
    const a = await user("test-a");
    await database()
      .update(tables.connections)
      .set({ expiresAt: new Date(0) })
      .where(eq(tables.connections.userId, a.id));
    let refreshes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/token")) {
          refreshes++;
          await new Promise((resolve) => setTimeout(resolve, 60));
          return Response.json({
            access_token: "new-access",
            refresh_token: "rotated-refresh",
          });
        }
        return Response.json({
          client_id: "synthetic-client",
          user_name: "test-a",
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: ["cvut:sirius:personal:read"],
        });
      }),
    );
    expect(
      await Promise.all(Array.from({ length: 6 }, () => accessToken(a.id))),
    ).toEqual(Array(6).fill("new-access"));
    expect(refreshes).toBe(1);
    expect(
      decrypt((await database().select().from(tables.connections))[0].refresh!),
    ).toBe("rotated-refresh");
  });
  it("persists reconnect state after an invalid refresh instead of rolling it back", async () => {
    const a = await user("test-a");
    await database()
      .update(tables.connections)
      .set({ expiresAt: new Date(0) })
      .where(eq(tables.connections.userId, a.id));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );
    await expect(accessToken(a.id)).rejects.toMatchObject({
      code: "reconnect",
    });
    expect(
      (await database().select().from(tables.connections))[0].reconnect,
    ).toBe(true);
  });
});
describe("Sirius synchronization", () => {
  it("normalizes cancellation and does not copy student lists or private provider fields", () => {
    const page = normalizePage({
      events: [
        {
          ...raw(1),
          deleted: true,
          access_token: "secret",
          links: { ...raw(1).links, students: ["private"] },
        },
      ],
    });
    expect(page.events[0].cancelled).toBe(true);
    expect(JSON.stringify(page)).not.toMatch(/secret|private/);
  });
  it("fetches all pages and rejects duplicate/truncated pages", async () => {
    const first = Array.from({ length: 100 }, (_, i) => raw(i));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        Response.json(
          new URL(String(url)).searchParams.get("offset") === "0"
            ? { meta: { count: 101, offset: 0 }, events: first }
            : { meta: { count: 101, offset: 100 }, events: [raw(100)] },
        ),
      ),
    );
    expect(
      await fetchEvents(
        "fake",
        "/people/test-a/events",
        semesterWindow(semester),
      ),
    ).toHaveLength(101);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ meta: { count: 101 }, events: first })),
    );
    await expect(
      fetchEvents("fake", "/people/test-a/events", semesterWindow(semester)),
    ).rejects.toMatchObject({ code: "incomplete_import" });
  });
  it("keeps the last snapshot after page failure and only removes events on a complete import", async () => {
    const a = await user("test-a");
    const oldTime = new Date("2026-09-01T00:00:00Z");
    await database()
      .insert(tables.snapshots)
      .values({
        userId: a.id,
        semester,
        window: semesterWindow(semester),
        events: [lesson],
        lastSuccess: oldTime,
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = new URL(String(url));
        if (u.pathname.endsWith("/semesters"))
          return Response.json({ semesters: [], meta: { count: 0 } });
        if (u.searchParams.get("offset") === "0")
          return Response.json({
            meta: { count: 101 },
            events: Array.from({ length: 100 }, (_, i) => raw(i)),
          });
        return Response.json({}, { status: 503 });
      }),
    );
    expect((await synchronize(a.id, semester, true))?.ok).toBe(false);
    let snapshot = (await database().select().from(tables.snapshots))[0];
    expect(snapshot.events).toEqual([lesson]);
    expect(snapshot.lastSuccess).toEqual(oldTime);
    await expect(synchronize(a.id, semester, true)).rejects.toMatchObject({
      code: "sync_cooldown",
    });
    await database()
      .update(tables.snapshots)
      .set({ lastAttempt: new Date(0) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        Response.json(
          String(url).includes("/semesters")
            ? { semesters: [], meta: { count: 0 } }
            : { events: [], meta: { count: 0 } },
        ),
      ),
    );
    expect((await synchronize(a.id, semester, true))?.ok).toBe(true);
    snapshot = (await database().select().from(tables.snapshots))[0];
    expect(snapshot.events).toEqual([]);
    expect(snapshot.error).toBeNull();
  });
});

// Group access and personal events use the same authenticated API as the UI.
import {
  GET as listGroups,
  POST as createGroup,
  PATCH as changeGroup,
} from "../src/app/api/groups/route";
import {
  GET as listEvents,
  POST as createEvent,
  PATCH as editEvent,
  DELETE as deleteEvent,
} from "../src/app/api/events/route";
async function makeGroup(
  owner: User,
  giving = { calendar: true, plans: true },
) {
  const response = await createGroup(
    req(owner, "/api/groups", "POST", { name: "Synthetic group", giving }),
  );
  expect(response.status).toBe(200);
  return (await response.json()).id as string;
}
async function groupAction(
  u: User,
  id: string,
  action: string,
  rest: Record<string, unknown> = {},
) {
  return changeGroup(req(u, "/api/groups", "PATCH", { id, action, ...rest }));
}
async function joinGroup(owner: User, member: User, id: string) {
  expect(
    (await groupAction(owner, id, "invite", { username: member.username }))
      .status,
  ).toBe(200);
  expect(
    (await groupAction(member, id, "accept", { giving: permission })).status,
  ).toBe(200);
}
async function viewCalendar(viewer: User, owner?: User) {
  return (
    await calendar(
      req(viewer, `/api/calendar${owner ? `?friends=${owner.id}` : ""}`),
    )
  ).json();
}
const personal = {
  course: "TV1-PE",
  title: "Synthetic sport",
  start: "2026-10-20T09:00",
  end: "2026-10-20T10:30",
  room: "Synthetic gym",
  color: "#158b98",
  note: "Bring shoes",
  repeatUntil: "2026-11-03",
};
describe("groups, overrides and attendance privacy", () => {
  it("requires acceptance and applies directional group permissions", async () => {
    const a = await user("group-a"),
      b = await user("group-b"),
      outsider = await user("outsider");
    const id = await makeGroup(a);
    await groupAction(a, id, "invite", { username: b.username });
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    const pending = await (await listGroups(req(b, "/api/groups"))).json();
    expect(pending.groups[0].members).toEqual([]);
    expect(
      (await groupAction(b, id, "sharing", { giving: permission })).status,
    ).toBe(403);
    expect(
      (await groupAction(outsider, id, "accept", { giving: permission }))
        .status,
    ).toBe(404);
    expect(
      (
        await groupAction(b, id, "accept", {
          giving: { calendar: false, plans: false },
        })
      ).status,
    ).toBe(200);
    expect((await viewCalendar(b, a)).calendars).toHaveLength(2);
    expect((await viewCalendar(a, b)).calendars).toHaveLength(1);
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared,
    ).toHaveLength(1);
    expect(
      (await groupAction(b, id, "invite", { username: outsider.username }))
        .status,
    ).toBe(403);
    expect((await groupAction(b, id, "delete")).status).toBe(403);
    expect(
      (
        await groupAction(a, id, "override", {
          target: outsider.id,
          giving: permission,
        })
      ).status,
    ).toBe(404);
  });
  it("a deny overrides multiple groups and friendship; resetting, leaving and deletion re-evaluate access", async () => {
    const a = await user("group-a"),
      b = await user("group-b");
    const first = await makeGroup(a),
      second = await makeGroup(a);
    await joinGroup(a, b, first);
    await joinGroup(a, b, second);
    await requestFriend(a.id, b.id, { calendar: true, plans: true });
    await changeFriend(
      req(b, "/api/friends", "PATCH", {
        id: a.id,
        action: "accept",
        giving: permission,
      }),
    );
    await groupAction(a, first, "override", {
      target: b.id,
      giving: { calendar: false, plans: false },
    });
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared,
    ).toHaveLength(0);
    await groupAction(a, second, "reset", { target: b.id });
    expect((await viewCalendar(b, a)).calendars).toHaveLength(2);
    await changeFriend(
      req(a, "/api/friends", "PATCH", {
        id: b.id,
        action: "sharing",
        giving: { calendar: false, plans: false },
      }),
    );
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    await groupAction(a, first, "reset", { target: b.id });
    await changeFriend(
      req(a, "/api/friends", "PATCH", { id: b.id, action: "remove" }),
    );
    await groupAction(b, first, "leave");
    expect((await viewCalendar(b, a)).calendars).toHaveLength(2);
    await groupAction(a, second, "delete");
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    expect(
      (await database().select().from(tables.members)).filter(
        (m) => m.userId === b.id,
      ),
    ).toHaveLength(0);
  });
  it("blocks group-only contacts and prevents stale explicit allows from surviving removal", async () => {
    const a = await user("group-a"),
      b = await user("group-b");
    const id = await makeGroup(a);
    await joinGroup(a, b, id);
    await groupAction(a, id, "override", {
      target: b.id,
      giving: { calendar: true, plans: true },
    });
    expect(
      (
        await changeFriend(
          req(a, "/api/friends", "PATCH", { id: b.id, action: "block" }),
        )
      ).status,
    ).toBe(200);
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    expect((await viewCalendar(a, b)).calendars).toHaveLength(1);
    await changeFriend(
      req(a, "/api/friends", "PATCH", { id: b.id, action: "unblock" }),
    );
    expect((await viewCalendar(b, a)).calendars).toHaveLength(2);
    await groupAction(a, id, "remove", { target: b.id });
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
  });
  it("returns only authorized matching attendees by default and clears them on revocation", async () => {
    const a = await user("group-a"),
      b = await user("group-b"),
      c = await user("group-c");
    for (const u of [a, b, c])
      await database()
        .insert(tables.snapshots)
        .values({
          userId: u.id,
          semester,
          window: semesterWindow(semester),
          events: [lesson],
        });
    const id = await makeGroup(a);
    await joinGroup(a, b, id);
    const result = await viewCalendar(b);
    expect(result.calendars).toHaveLength(1);
    expect(
      result.attendees[lesson.id].map((p: { id: string }) => p.id),
    ).toEqual([a.id]);
    expect(result.people.map((p: { id: string }) => p.id)).not.toContain(c.id);
    await groupAction(a, id, "sharing", {
      giving: { calendar: false, plans: true },
    });
    expect((await viewCalendar(b)).attendees).toEqual({});
    expect(
      (await (await plans(req(b, "/api/plans"))).json()).shared,
    ).toHaveLength(1);
  });
  it("serializes duplicate group invitations and cascades account deletion", async () => {
    const a = await user("group-a"),
      b = await user("group-b");
    const id = await makeGroup(a);
    const replies = await Promise.all(
      [1, 2].map(() => groupAction(a, id, "invite", { username: b.username })),
    );
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    await deleteMe(req(a, "/api/me", "DELETE", { confirm: "DELETE" }));
    expect(await database().select().from(tables.groups)).toHaveLength(0);
    expect(await database().select().from(tables.members)).toHaveLength(0);
  });
});
describe("personal subjects and events", () => {
  it("supports own CRUD, includes weekly events in authorized calendars, and denies ID tampering", async () => {
    const a = await user("event-a"),
      b = await user("event-b");
    const created = await createEvent(
      req(a, "/api/events", "POST", { semester, event: personal }),
    );
    expect(created.status).toBe(200);
    const { id } = await created.json();
    const own = await viewCalendar(a);
    expect(own.calendars[0].events).toHaveLength(3);
    expect(own.calendars[0].events[0]).toMatchObject({
      course: "TV1-PE",
      type: "personal",
      color: "#158b98",
    });
    expect(
      (await (await listEvents(req(b, "/api/events"))).json()).events,
    ).toHaveLength(0);
    expect(
      (await editEvent(req(b, "/api/events", "PATCH", { id, event: personal })))
        .status,
    ).toBe(404);
    expect(
      (await deleteEvent(req(b, "/api/events", "DELETE", { id }))).status,
    ).toBe(404);
    const group = await makeGroup(a);
    await joinGroup(a, b, group);
    expect((await viewCalendar(b, a)).calendars[1].events).toHaveLength(3);
    expect(
      (
        await editEvent(
          req(a, "/api/events", "PATCH", {
            id,
            event: {
              ...personal,
              course: "TV2",
              color: "#ff8800",
              repeatUntil: null,
            },
          }),
        )
      ).status,
    ).toBe(200);
    const shared = (await viewCalendar(b, a)).calendars[1].events;
    expect(shared).toHaveLength(1);
    expect(shared[0].course).toBe("TV2");
    expect(shared[0].color).toBe("#ff8800");
    await groupAction(a, group, "override", {
      target: b.id,
      giving: { calendar: false, plans: false },
    });
    expect((await viewCalendar(b, a)).calendars).toHaveLength(1);
    await deleteEvent(req(a, "/api/events", "DELETE", { id }));
    expect((await viewCalendar(a)).calendars[0].events).toHaveLength(0);
  });
  it("rejects invalid intervals, excessive recurrence, CSS injection and cross-origin writes", async () => {
    const a = await user("event-a");
    for (const invalid of [
      { end: personal.start },
      { start: "not-a-date" },
      { repeatUntil: "2028-01-01" },
      { color: "url(https://example.org)" },
      { repeatUntil: "2026-02-30" },
    ])
      expect(
        (
          await createEvent(
            req(a, "/api/events", "POST", {
              semester,
              event: { ...personal, ...invalid },
            }),
          )
        ).status,
      ).toBe(400);
    expect(
      (
        await createEvent(
          req(
            a,
            "/api/events",
            "POST",
            { semester, event: personal },
            "https://attacker.invalid",
          ),
        )
      ).status,
    ).toBe(403);
    expect(await database().select().from(tables.personalEvents)).toHaveLength(
      0,
    );
  });
});
