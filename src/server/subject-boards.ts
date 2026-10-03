import { and, eq } from "drizzle-orm";
import type { DB, TX } from "./db";
import { snapshots, personalEvents, subjectBoards } from "./schema";
import type { SubjectSummary } from "../lib/subject-board";

/** Only the signed-in user's imports, personal subjects and saved boards. */
export async function ownSubjects(
  db: DB | TX,
  userId: string,
  semester: string,
) {
  const [snapshot] = await db
    .select({ events: snapshots.events })
    .from(snapshots)
    .where(and(eq(snapshots.userId, userId), eq(snapshots.semester, semester)));
  const personal = await db
    .select({ details: personalEvents.details })
    .from(personalEvents)
    .where(
      and(
        eq(personalEvents.owner, userId),
        eq(personalEvents.semester, semester),
      ),
    );
  const saved = await db
    .select({ course: subjectBoards.course, title: subjectBoards.title })
    .from(subjectBoards)
    .where(
      and(
        eq(subjectBoards.userId, userId),
        eq(subjectBoards.semester, semester),
      ),
    );
  const subjects = new Map<string, SubjectSummary>();
  for (const subject of [
    ...saved,
    ...personal.map(({ details }) => ({
      course: details.course,
      title: { cs: details.title, en: details.title },
    })),
    ...(snapshot?.events || []),
  ]) {
    if (subject.course)
      subjects.set(subject.course, {
        course: subject.course,
        title: subject.title,
      });
  }
  return [...subjects.values()].sort((a, b) =>
    a.course.localeCompare(b.course),
  );
}
