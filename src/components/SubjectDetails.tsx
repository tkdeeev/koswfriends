import { useState } from "react";
import ClassExplorer from "./ClassExplorer";
import { DateTime } from "luxon";
import type { Lesson } from "@/lib/types";
import { localizedText, type Locale } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import { ZONE } from "@/lib/calendar";
import s from "./Daily.module.css";
export default function SubjectDetails({
  lesson,
  locale,
  semester,
}: {
  lesson: Lesson;
  locale: Locale;
  semester: string;
}) {
  const t = dailyCopy[locale];
  const [explore, setExplore] = useState(false);
  if (lesson.personalId) return null;
  const changes = lesson.changes || [];
  return (
    <section className={s.subject} aria-label={t.details}>
      {!!lesson.teachers?.length && (
        <>
          <h3>{t.teachers}</h3>
          <div className={s.teacherList}>
            {lesson.teachers.map((teacher) => (
              <a
                className={s.teacherChip}
                key={teacher.username}
                href={`https://usermap.cvut.cz/profile/${encodeURIComponent(teacher.username)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${teacher.name} · ${t.teacherProfile}`}
                title={`@${teacher.username}`}
              >
                <span>{teacher.name}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </>
      )}
      {(changes.length > 0 ||
        lesson.original?.start ||
        lesson.original?.room) && (
        <div className={s.changes}>
          <strong>{t.changes}</strong>
          {changes.map((c, i) => (
            <p key={i}>
              {localizedText(c.name, locale)}
              {localizedText(c.note, locale) && (
                <>
                  <br />
                  {localizedText(c.note, locale)}
                </>
              )}
            </p>
          ))}
          {lesson.original && (
            <p>
              {t.original}:{" "}
              {lesson.original.start &&
                DateTime.fromISO(lesson.original.start)
                  .setZone(ZONE)
                  .setLocale(locale)
                  .toFormat("d. LLL HH:mm")}
              {lesson.original.end &&
                `–${DateTime.fromISO(lesson.original.end).setZone(ZONE).toFormat("HH:mm")}`}{" "}
              {lesson.original.room}
            </p>
          )}
        </div>
      )}
      {lesson.course && (
        <button className={s.exploreButton} onClick={() => setExplore(true)}>
          {t.otherClasses}
          <span aria-hidden="true">→</span>
        </button>
      )}
      {explore && (
        <ClassExplorer
          lesson={lesson}
          locale={locale}
          semester={semester}
          close={() => setExplore(false)}
        />
      )}
    </section>
  );
}
