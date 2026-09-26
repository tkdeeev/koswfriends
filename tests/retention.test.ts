import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { database, closeDatabase } from "../src/server/db";
import * as tables from "../src/server/schema";
import { applyRetention, RETENTION_INTERVAL_MS } from "../src/server/retention";
import { hash } from "../src/server/security";
import { semesterWindow } from "../src/lib/calendar";

if (
  process.env.KWF_TEST_DATABASE !== "yes" ||
  !process.env.DATABASE_URL?.endsWith("/koswfriends_test")
)
  throw new Error("Tests require an isolated test database");

const semester = "B261";
const now = new Date("2027-09-26T12:00:00.000Z");
const cutoff = new Date(now.getTime() - 365 * RETENTION_INTERVAL_MS);

async function user(username: string, activeAt: Date) {
  const [row] = await database()
    .insert(tables.users)
    .values({ username, name: username, semester, activeAt })
    .returning();
  return row;
}

beforeEach(async () => {
  await database().delete(tables.users);
});
afterAll(closeDatabase);

describe("account retention", () => {
  it("deletes only accounts inactive for more than 365 days", async () => {
    const expired = await user("retention-expired", new Date(+cutoff - 1));
    const boundary = await user("retention-boundary", cutoff);
    const recent = await user("retention-recent", new Date(+cutoff + 1));
    // A successful automated import must not extend the account's lifetime.
    await database()
      .insert(tables.snapshots)
      .values({
        userId: expired.id,
        semester,
        events: [],
        window: semesterWindow(semester),
        lastSuccess: now,
      });
    await applyRetention(now);
    expect(
      (await database().select().from(tables.users)).map((u) => u.id).sort(),
    ).toEqual([boundary.id, recent.id].sort());
    expect(await database().select().from(tables.snapshots)).toHaveLength(0);
    await applyRetention(now);
    expect(await database().select().from(tables.users)).toHaveLength(2);
  });

  it("preserves an old account when the person uses it again", async () => {
    const returning = await user("retention-returning", new Date(+cutoff - 1));
    await database()
      .update(tables.users)
      .set({ activeAt: now })
      .where(eq(tables.users.id, returning.id));
    await applyRetention(now);
    expect((await database().select().from(tables.users))[0]?.id).toBe(
      returning.id,
    );
  });

  it("cascades private records and owned groups without deleting other accounts", async () => {
    const expired = await user("retention-owner", new Date(+cutoff - 1));
    const active = await user("retention-member", now);
    const [a, b] = [expired.id, active.id].sort();
    await database().insert(tables.connections).values({
      userId: expired.id,
      access: "synthetic-encrypted-access",
      expiresAt: now,
    });
    await database()
      .insert(tables.sessions)
      .values({
        userId: expired.id,
        hash: hash("retention-session"),
        csrf: "synthetic-csrf",
        expiresAt: new Date(+now + RETENTION_INTERVAL_MS),
      });
    await database().insert(tables.friendships).values({
      a,
      b,
      requester: expired.id,
      status: "accepted",
    });
    for (const [owner, viewer] of [
      [expired.id, active.id],
      [active.id, expired.id],
    ]) {
      await database()
        .insert(tables.grants)
        .values({ owner, viewer, calendar: true });
      await database()
        .insert(tables.overrides)
        .values({ owner, viewer, calendar: true, plans: false });
      await database().insert(tables.blocks).values({ owner, target: viewer });
    }
    await database()
      .insert(tables.invites)
      .values({
        owner: expired.id,
        hash: hash("retention-invite"),
        calendar: true,
        plans: false,
        expiresAt: new Date(+now + RETENTION_INTERVAL_MS),
      });
    await database()
      .insert(tables.plans)
      .values({ userId: expired.id, semester, choices: [] });
    await database()
      .insert(tables.personalEvents)
      .values({
        owner: expired.id,
        semester,
        details: {
          course: "PERSONAL",
          title: "Synthetic event",
          start: now.toISOString(),
          end: new Date(+now + 3600000).toISOString(),
          room: "",
          color: "#127f75",
          note: "Synthetic private note",
          repeatUntil: null,
        },
      });
    const [expiredGroup, activeGroup] = await database()
      .insert(tables.groups)
      .values([
        { owner: expired.id, name: "Expired owner's group" },
        { owner: active.id, name: "Active owner's group" },
      ])
      .returning();
    await database()
      .insert(tables.members)
      .values([
        { groupId: expiredGroup.id, userId: expired.id, status: "accepted" },
        { groupId: expiredGroup.id, userId: active.id, status: "accepted" },
        { groupId: activeGroup.id, userId: expired.id, status: "accepted" },
        { groupId: activeGroup.id, userId: active.id, status: "accepted" },
      ]);
    await database()
      .insert(tables.groupInvites)
      .values({
        groupId: expiredGroup.id,
        hash: hash("retention-group-invite"),
        token: "synthetic-encrypted-token",
        expiresAt: new Date(+now + RETENTION_INTERVAL_MS),
      });

    await applyRetention(now);

    expect(
      (await database().select().from(tables.users)).map((u) => u.id),
    ).toEqual([active.id]);
    for (const table of [
      tables.connections,
      tables.sessions,
      tables.friendships,
      tables.grants,
      tables.overrides,
      tables.blocks,
      tables.invites,
      tables.plans,
      tables.personalEvents,
      tables.groupInvites,
    ]) {
      expect(await database().select().from(table)).toHaveLength(0);
    }
    expect(
      (await database().select().from(tables.groups)).map((g) => g.id),
    ).toEqual([activeGroup.id]);
    const memberships = await database().select().from(tables.members);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      groupId: activeGroup.id,
      userId: active.id,
    });
  });

  it("removes expired group link tokens while preserving valid links and members", async () => {
    const active = await user("retention-links", now);
    const [expired, valid] = await database()
      .insert(tables.groups)
      .values([
        { owner: active.id, name: "Expired link" },
        { owner: active.id, name: "Valid link" },
      ])
      .returning();
    await database().insert(tables.members).values({
      groupId: expired.id,
      userId: active.id,
      status: "accepted",
    });
    await database()
      .insert(tables.groupInvites)
      .values([
        {
          groupId: expired.id,
          hash: hash("expired-link"),
          token: "expired-token",
          expiresAt: new Date(+now - 1),
        },
        {
          groupId: valid.id,
          hash: hash("valid-link"),
          token: "valid-token",
          expiresAt: new Date(+now + 1),
        },
      ]);
    await applyRetention(now);
    expect(
      (await database().select().from(tables.groupInvites)).map(
        (i) => i.groupId,
      ),
    ).toEqual([valid.id]);
    expect(await database().select().from(tables.groups)).toHaveLength(2);
    expect(await database().select().from(tables.members)).toHaveLength(1);
  });
});
