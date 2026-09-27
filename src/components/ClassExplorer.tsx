"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import type { Lesson } from "@/lib/types";
import { lessonType, type Locale } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import { ZONE } from "@/lib/calendar";
import DetailModal from "./DetailModal";
import s from "./Daily.module.css";
type Group = { key: string; events: Lesson[] };
export default function ClassExplorer({
  lesson,
  locale,
  semester,
  close,
}: {
  lesson: Lesson;
  locale: Locale;
  semester: string;
  close: () => void;
}) {
  const t = dailyCopy[locale];
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [selected, setSelected] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setFailed(false);
    void (async () => {
      try {
        const r = await fetch(
          `/api/course-search?course=${encodeURIComponent(lesson.course)}&semester=${semester}`,
          {
            cache: "no-store",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30000),
            ]),
          },
        );
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!disposed)
          setGroups(
            data.groups.filter((g: Group) =>
              g.events.some((e) => !e.cancelled),
            ),
          );
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [lesson.course, semester, attempt]);
  const active =
    groups?.find((g) => g.key === selected) ||
    groups?.find((g) => g.key === `${lesson.type}:${lesson.group}`) ||
    groups?.[0];
  const ordered =
    active?.events
      .filter((e) => !e.cancelled)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) || [];
  const sample =
    ordered.find((e) => Date.parse(e.end) >= Date.parse(lesson.start)) ||
    ordered[0];
  const teachers = [
    ...new Map(
      ordered.flatMap((e) => e.teachers || []).map((t) => [t.username, t]),
    ).values(),
  ];
  const dates = ordered
    .filter((e) => Date.parse(e.end) >= Date.parse(lesson.start))
    .slice(0, 8);
  return (
    <DetailModal
      title={`${lesson.course} · ${t.otherClasses}`}
      locale={locale}
      close={close}
      className={s.explorer}
    >
      {failed ? (
        <p role="alert">
          {t.courseUnavailable}{" "}
          <button className={s.link} onClick={() => setAttempt((n) => n + 1)}>
            {t.retry}
          </button>
        </p>
      ) : !groups ? (
        <p role="status">{t.loading}</p>
      ) : !sample ? (
        <p>{t.unavailable}</p>
      ) : (
        <>
          <div
            className={s.classPicker}
            role="group"
            aria-label={t.otherClasses}
          >
            {groups.map((g) => {
              const e = g.events.find((e) => !e.cancelled)!;
              return (
                <button
                  key={g.key}
                  aria-pressed={active?.key === g.key}
                  onClick={() => setSelected(g.key)}
                >
                  {lessonType(e.type, locale)} {e.group}
                </button>
              );
            })}
          </div>
          <dl className={s.facts}>
            <div>
              <dt>{t.capacity}</dt>
              <dd>
                {sample.occupied ?? "—"} / {sample.capacity ?? "—"}
              </dd>
            </div>
          </dl>
          {teachers.length > 0 && (
            <>
              <h3>{t.teachers}</h3>
              {teachers.map((teacher) => (
                <a
                  key={teacher.username}
                  className={s.teacherLink}
                  href={`https://usermap.cvut.cz/profile/${encodeURIComponent(teacher.username)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <strong>{teacher.name}</strong>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </>
          )}
          <h3>{t.upcomingClasses}</h3>
          {dates.length ? (
            <ul className={s.classDates}>
              {dates.map((e) => (
                <li key={e.id}>
                  <span>
                    {DateTime.fromISO(e.start)
                      .setZone(ZONE)
                      .setLocale(locale)
                      .toFormat("ccc d. LLL")}
                    <strong>
                      {DateTime.fromISO(e.start)
                        .setZone(ZONE)
                        .toFormat("HH:mm")}
                      –{DateTime.fromISO(e.end).setZone(ZONE).toFormat("HH:mm")}
                    </strong>
                  </span>
                  <span>{e.room}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>{t.unavailable}</p>
          )}
        </>
      )}
    </DetailModal>
  );
}
