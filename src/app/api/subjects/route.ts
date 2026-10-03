import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { boardAction, boardKey, type SubjectBoard } from "@/lib/subject-board";
import { database } from "@/server/db";
import { body, endpoint, json, session } from "@/server/http";
import { subjectBoards } from "@/server/schema";
import { ownSubjects } from "@/server/subject-boards";
import { AppError } from "@/server/security";

export const dynamic = "force-dynamic";
const scope = (userId: string, semester: string, course: string) =>
  and(
    eq(subjectBoards.userId, userId),
    eq(subjectBoards.semester, semester),
    eq(subjectBoards.course, course),
  );
const publicBoard = (board: SubjectBoard): SubjectBoard => ({
  course: board.course,
  semester: board.semester,
  notes: board.notes,
  tasks: board.tasks,
  revision: board.revision,
});
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const semester = boardKey.shape.semester.parse(
    req.nextUrl.searchParams.get("semester") || user.semester,
  );
  const subjects = await ownSubjects(database(), user.id, semester);
  const courseParam = req.nextUrl.searchParams.get("course");
  if (courseParam === null) return json({ subjects });
  const course = boardKey.shape.course.parse(courseParam);
  if (!subjects.some((subject) => subject.course === course))
    throw new AppError("subject_not_found", 404);
  const [row] = await database()
    .select()
    .from(subjectBoards)
    .where(scope(user.id, semester, course));
  return json({
    board: row
      ? publicBoard(row)
      : { course, semester, notes: "", tasks: [], revision: 0 },
  });
});

export const POST = endpoint(async (req) => {
  const { user } = await session(req, true);
  const data = boardKey
    .extend({ revision: z.number().int().min(0), change: boardAction })
    .parse(await body(req));
  const board = await database().transaction(async (tx) => {
    // Serialize even the first write; the revision also protects edits from other tabs/devices.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`subject:${user.id}:${data.semester}:${data.course}`}))`,
    );
    const subject = (await ownSubjects(tx, user.id, data.semester)).find(
      (subject) => subject.course === data.course,
    );
    if (!subject) throw new AppError("subject_not_found", 404);
    const [row] = await tx
      .select()
      .from(subjectBoards)
      .where(scope(user.id, data.semester, data.course));
    if ((row?.revision || 0) !== data.revision)
      throw new AppError("board_conflict", 409);
    let notes = row?.notes || "";
    let tasks = row?.tasks || [];
    const change = data.change;
    if (change.action === "notes") notes = change.notes;
    else if (change.action === "add") {
      if (tasks.length >= 100) throw new AppError("board_full", 409);
      tasks.push({ ...change.task, id: randomUUID(), status: change.status });
    } else {
      const task = tasks.find((task) => task.id === change.id);
      if (!task) throw new AppError("task_not_found", 404);
      if (change.action === "delete")
        tasks = tasks.filter((task) => task.id !== change.id);
      else if (change.action === "edit") Object.assign(task, change.task);
      else if (change.action === "check") {
        const item = task.checklist.find((item) => item.id === change.itemId);
        if (!item) throw new AppError("task_not_found", 404);
        item.done = change.done;
      } else if (change.action === "move") {
        if (change.beforeId === task.id) throw new AppError("invalid_request");
        tasks = tasks.filter((item) => item.id !== task.id);
        const before = change.beforeId
          ? tasks.findIndex(
              (item) =>
                item.id === change.beforeId && item.status === change.status,
            )
          : tasks.length;
        if (before < 0) throw new AppError("invalid_request");
        task.status = change.status;
        tasks.splice(before, 0, task);
      }
    }
    const values = { notes, tasks, revision: data.revision + 1 };
    await tx
      .insert(subjectBoards)
      .values({
        userId: user.id,
        semester: data.semester,
        course: data.course,
        title: subject.title,
        ...values,
      })
      .onConflictDoUpdate({
        target: [
          subjectBoards.userId,
          subjectBoards.semester,
          subjectBoards.course,
        ],
        set: values,
      });
    return { course: data.course, semester: data.semester, ...values };
  });
  return json({ board });
});
