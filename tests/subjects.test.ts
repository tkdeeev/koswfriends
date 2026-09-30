import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { database, closeDatabase } from "../src/server/db";
import {
  users,
  sessions,
  snapshots,
  subjectBoards,
  personalEvents,
  grants,
  friendships,
} from "../src/server/schema";
import { hash } from "../src/server/security";
import { semesterWindow } from "../src/lib/calendar";
import { GET, POST } from "../src/app/api/subjects/route";
import { GET as calendar } from "../src/app/api/calendar/route";
import { exportAccount } from "../src/server/export";
import { applyRetention } from "../src/server/retention";
import type {
  BoardAction,
  SubjectBoard,
  TaskData,
} from "../src/lib/subject-board";
if (
  process.env.KWF_TEST_DATABASE !== "yes" ||
  !process.env.DATABASE_URL?.endsWith("/koswfriends_test")
)
  throw new Error("Only isolated synthetic databases allowed");
const semester = "B261";
const course = "TEST-MAT";
const task: TaskData = {
  title: "Assignment",
  description: "Private description",
  dueDate: "2026-10-20",
  checklist: [{ id: randomUUID(), text: "Read chapter", done: false }],
};
async function seed(name: string, subject = course) {
  const [user] = await database()
    .insert(users)
    .values({ username: name, name, semester })
    .returning();
  await database()
    .insert(sessions)
    .values({
      userId: user.id,
      hash: hash(name),
      csrf: name,
      expiresAt: new Date(Date.now() + 3600000),
    });
  await database()
    .insert(snapshots)
    .values({
      userId: user.id,
      semester,
      window: semesterWindow(semester),
      events: [
        {
          id: "test-lesson",
          course: subject,
          title: { cs: "Matematika", en: "Mathematics" },
          type: "lecture",
          group: "1",
          start: "2026-10-01T09:00:00Z",
          end: "2026-10-01T10:00:00Z",
          room: "T-1",
          cancelled: false,
        },
      ],
    });
  return user;
}
type User = Awaited<ReturnType<typeof seed>>;
function request(
  user: User,
  data?: unknown,
  query = `semester=${semester}&course=${course}`,
) {
  return new NextRequest(`http://localhost:3100/api/subjects?${query}`, {
    method: data ? "POST" : "GET",
    headers: {
      cookie: `kwf_session=${user.username}`,
      origin: "http://localhost:3100",
      "x-csrf-token": user.username,
      "content-type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
const write = (user: User, revision: number, change: BoardAction) =>
  POST(request(user, { semester, course, revision, change }));
async function change(
  user: User,
  revision: number,
  action: BoardAction,
): Promise<SubjectBoard> {
  const response = await write(user, revision, action);
  expect(response.status).toBe(200);
  return (await response.json()).board;
}
beforeEach(async () => {
  await database().delete(users);
});
afterAll(closeDatabase);

it("requires a live session and CSRF for every write", async () => {
  expect(
    (await GET(new NextRequest("http://localhost:3100/api/subjects"))).status,
  ).toBe(401);
  expect(
    (
      await POST(
        new NextRequest("http://localhost:3100/api/subjects", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(401);
  const user = await seed("auth");
  const missing = request(user, {
    semester,
    course,
    revision: 0,
    change: { action: "notes", notes: "secret" },
  });
  missing.headers.delete("x-csrf-token");
  expect((await POST(missing)).status).toBe(403);
  const foreign = request(user, {});
  foreign.headers.set("origin", "https://foreign.example");
  expect((await POST(foreign)).status).toBe(403);
  expect((await GET(request(user))).headers.get("Cache-Control")).toContain(
    "no-store",
  );
  await database()
    .update(sessions)
    .set({ expiresAt: new Date(0) });
  expect((await GET(request(user))).status).toBe(401);
});

it("keeps boards private even for shared subjects, ignores owner parameters and rejects subjects belonging only to a friend", async () => {
  const owner = await seed("owner"),
    peer = await seed("peer"),
    other = await seed("other", "OTHER");
  const [a, b] = [owner.id, peer.id].sort();
  await database()
    .insert(friendships)
    .values({ a, b, requester: owner.id, status: "accepted" });
  await database()
    .insert(grants)
    .values({ owner: owner.id, viewer: peer.id, calendar: true, plans: true });
  const board = await change(owner, 0, { action: "add", status: "todo", task });
  await change(owner, board.revision, {
    action: "notes",
    notes: "SECRET-NOTES",
  });
  const response = await GET(
    request(
      peer,
      undefined,
      `semester=${semester}&course=${course}&userId=${owner.id}`,
    ),
  );
  expect((await response.json()).board).toMatchObject({ notes: "", tasks: [] });
  expect(
    (await write(peer, 0, { action: "delete", id: board.tasks[0].id })).status,
  ).toBe(404);
  expect((await GET(request(other))).status).toBe(404);
  expect(
    (await write(other, 0, { action: "notes", notes: "attempt" })).status,
  ).toBe(404);
  const shared = await (
    await calendar(
      new NextRequest(
        `http://localhost:3100/api/calendar?semester=${semester}&friends=${owner.id}`,
        { headers: { cookie: `kwf_session=${peer.username}` } },
      ),
    )
  ).text();
  expect(shared).toContain(owner.id);
  expect(shared).not.toContain("SECRET-NOTES");
  expect(shared).not.toContain("Private description");
  expect(JSON.stringify(await exportAccount(peer.id))).not.toContain(
    "SECRET-NOTES",
  );
});

it("persists notes, card editing, checklists, ordering, status and deletion", async () => {
  const user = await seed("lifecycle");
  let board = await change(user, 0, {
    action: "notes",
    notes: "Private notes\nsecond line",
  });
  board = await change(user, board.revision, {
    action: "add",
    status: "todo",
    task,
  });
  const id = board.tasks[0].id;
  board = await change(user, board.revision, {
    action: "add",
    status: "todo",
    task: { ...task, title: "Second" },
  });
  const second = board.tasks[1].id;
  board = await change(user, board.revision, {
    action: "move",
    id: second,
    status: "todo",
    beforeId: id,
  });
  expect(board.tasks.map((task) => task.id)).toEqual([second, id]);
  board = await change(user, board.revision, {
    action: "edit",
    id,
    task: { ...task, title: "Updated" },
  });
  board = await change(user, board.revision, {
    action: "check",
    id,
    itemId: task.checklist[0].id,
    done: true,
  });
  board = await change(user, board.revision, {
    action: "move",
    id,
    status: "doing",
  });
  board = await change(user, board.revision, {
    action: "move",
    id,
    status: "done",
  });
  const read = (await (await GET(request(user))).json()).board;
  expect(read).toEqual(board);
  expect(read.tasks[1]).toMatchObject({
    title: "Updated",
    status: "done",
    checklist: [{ done: true }],
  });
  board = await change(user, board.revision, { action: "delete", id });
  expect(board.tasks).toHaveLength(1);
  expect(board.notes).toBe("Private notes\nsecond line");
  board = await change(user, board.revision, { action: "notes", notes: "" });
  expect(board.notes).toBe("");
});

it("retains saved boards after imports change and scopes new boards to owned subjects and semesters", async () => {
  const user = await seed("semesters");
  await change(user, 0, { action: "notes", notes: "Keep after sync" });
  await database()
    .update(snapshots)
    .set({ events: [] })
    .where(eq(snapshots.userId, user.id));
  expect(
    (await (await GET(request(user, undefined, `semester=${semester}`))).json())
      .subjects,
  ).toHaveLength(1);
  expect((await (await GET(request(user))).json()).board.notes).toBe(
    "Keep after sync",
  );
  expect(
    (await GET(request(user, undefined, `semester=B262&course=${course}`)))
      .status,
  ).toBe(404);
  await database()
    .insert(personalEvents)
    .values({
      owner: user.id,
      semester,
      details: {
        course: "TV1-PE",
        title: "Swimming",
        start: "2026-10-01T09:00:00Z",
        end: "2026-10-01T10:00:00Z",
        room: "",
        color: "#0079c1",
        note: "Shared event note",
        repeatUntil: null,
      },
    });
  expect(
    (await GET(request(user, undefined, `semester=${semester}&course=TV1-PE`)))
      .status,
  ).toBe(200);
  expect(
    (
      await POST(
        request(user, {
          semester,
          course: "TV1-PE",
          revision: 0,
          change: { action: "notes", notes: "Private swimming note" },
        }),
      )
    ).status,
  ).toBe(200);
  await database()
    .delete(personalEvents)
    .where(eq(personalEvents.owner, user.id));
  expect(
    (await GET(request(user, undefined, `semester=${semester}&course=TV1-PE`)))
      .status,
  ).toBe(200);
});

it("rejects concurrent stale writes including creation of a board", async () => {
  const user = await seed("concurrent");
  const responses = await Promise.all([
    write(user, 0, { action: "notes", notes: "First" }),
    write(user, 0, { action: "notes", notes: "Second" }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const saved = (await (await GET(request(user))).json()).board;
  expect(saved.revision).toBe(1);
  expect(
    (await write(user, 0, { action: "notes", notes: "stale" })).status,
  ).toBe(409);
  expect((await (await GET(request(user))).json()).board.notes).toBe(
    saved.notes,
  );
});

it("validates content, references and size limits without partial writes", async () => {
  const user = await seed("validation");
  for (const change of [
    { action: "notes", notes: "a".repeat(8001) },
    { action: "add", status: "todo", task: { ...task, title: " " } },
    { action: "add", status: "todo", task: { ...task, dueDate: "2026-02-30" } },
    {
      action: "add",
      status: "todo",
      task: { ...task, checklist: [task.checklist[0], task.checklist[0]] },
    },
    { action: "add", status: "unknown", task },
  ])
    expect(
      (await POST(request(user, { semester, course, revision: 0, change })))
        .status,
    ).toBe(400);
  let board = await change(user, 0, { action: "add", status: "todo", task });
  expect(
    (
      await write(user, 1, {
        action: "check",
        id: board.tasks[0].id,
        itemId: randomUUID(),
        done: true,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await write(user, 1, {
        action: "move",
        id: board.tasks[0].id,
        status: "todo",
        beforeId: randomUUID(),
      })
    ).status,
  ).toBe(400);
  expect((await (await GET(request(user))).json()).board.revision).toBe(1);
  await database()
    .update(subjectBoards)
    .set({
      tasks: Array.from({ length: 100 }, () => ({
        ...task,
        id: randomUUID(),
        status: "todo" as const,
      })),
    });
  expect(
    (await write(user, 1, { action: "add", status: "todo", task })).status,
  ).toBe(409);
});

it("exports personal boards and removes them with account deletion or retention", async () => {
  const user = await seed("export");
  await change(user, 0, { action: "notes", notes: "Export me" });
  expect((await exportAccount(user.id)).subjectBoards).toEqual([
    expect.objectContaining({ notes: "Export me", course, semester }),
  ]);
  await database().delete(users).where(eq(users.id, user.id));
  expect(await database().select().from(subjectBoards)).toHaveLength(0);
  const inactive = await seed("retention");
  await change(inactive, 0, { action: "notes", notes: "Expired" });
  await database()
    .update(users)
    .set({ activeAt: new Date("2020-01-01") })
    .where(eq(users.id, inactive.id));
  await applyRetention();
  expect(await database().select().from(subjectBoards)).toHaveLength(0);
});
