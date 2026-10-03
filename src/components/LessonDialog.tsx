"use client";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { DateTime } from "luxon";
import { ZONE } from "@/lib/calendar";
import { lessonColor } from "@/lib/appearance";
import { localizedText, lessonType, type Locale, type Text } from "@/lib/i18n";
import { dailyCopy } from "@/lib/daily-copy";
import { subjectCopy } from "@/lib/subject-copy";
import type { Display } from "./CalendarView";
import Avatar from "./Avatar";
import { PersonLink } from "./PeopleProvider";
import SubjectDetails from "./SubjectDetails";
import s from "./Workspace.module.css";
const colorStyle = (type: string, custom?: string) =>
  ({ "--lesson-color": custom || lessonColor(type) }) as CSSProperties;
export default function LessonDialog({
  detail,
  close,
  locale,
  t,
  onEditEvent,
  semester,
}: {
  semester: string;
  detail: Display;
  close: () => void;
  locale: Locale;
  t: Text;
  onEditEvent: (id?: string) => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  const time = (iso: string) =>
    DateTime.fromISO(iso).setZone(ZONE).toFormat("HH:mm");
  const facts = [
    ...(detail.lesson.room
      ? [{ label: t.room, value: detail.lesson.room }]
      : []),
    ...(detail.lesson.group
      ? [{ label: t.group, value: detail.lesson.group }]
      : []),
    ...(!detail.lesson.personalId &&
    (detail.lesson.occupied != null || detail.lesson.capacity != null)
      ? [
          {
            label: dailyCopy[locale].capacity,
            value: `${detail.lesson.occupied ?? "—"} / ${detail.lesson.capacity ?? "—"}`,
          },
        ]
      : []),
    ...(!detail.lesson.personalId && detail.lesson.sequence != null
      ? [
          {
            label: dailyCopy[locale].sequence,
            value: String(detail.lesson.sequence),
          },
        ]
      : []),
  ];
  return (
    <dialog
      ref={dialog}
      className={s.lessonDialog}
      aria-labelledby={titleId}
      style={
        detail ? colorStyle(detail.lesson.type, detail.lesson.color) : undefined
      }
      onClose={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {detail && (
        <>
          <header className={s.lessonDialogHeader}>
            <div className={s.lessonDialogTop}>
              <span>{lessonType(detail.lesson.type, locale)}</span>
              <button
                className={s.iconButton}
                onClick={close}
                aria-label={t.close}
                autoFocus
              >
                ×
              </button>
            </div>
            <h2 id={titleId}>
              {detail.lesson.course ||
                localizedText(detail.lesson.title, locale)}
            </h2>
            <div className={s.lessonDialogWhen}>
              <span className={s.lessonDialogTime}>
                {time(detail.lesson.start)}–{time(detail.lesson.end)}
              </span>
              <p className={s.lessonDialogDate}>
                {DateTime.fromISO(detail.lesson.start)
                  .setZone(ZONE)
                  .setLocale(locale)
                  .toLocaleString(DateTime.DATE_FULL)}
                {!DateTime.fromISO(detail.lesson.start)
                  .setZone(ZONE)
                  .hasSame(
                    DateTime.fromISO(detail.lesson.end).setZone(ZONE),
                    "day",
                  ) && (
                  <>
                    {" "}
                    –{" "}
                    {DateTime.fromISO(detail.lesson.end)
                      .setZone(ZONE)
                      .setLocale(locale)
                      .toLocaleString(DateTime.DATE_FULL)}
                  </>
                )}
              </p>
            </div>
            {(detail.lesson.cancelled || detail.draft) && (
              <div className={s.lessonDialogStatus}>
                {detail.lesson.cancelled && (
                  <span className={`${s.badge} ${s.badgeWarning}`}>
                    {t.cancelled}
                  </span>
                )}
                {detail.draft && <span className={s.badge}>{t.draft}</span>}
              </div>
            )}
          </header>
          <div className={s.lessonDialogBody}>
            {detail.lesson.course &&
              localizedText(detail.lesson.title, locale) !==
                detail.lesson.course && (
                <h3>{localizedText(detail.lesson.title, locale)}</h3>
              )}
            {facts.length > 0 && (
              <dl className={s.lessonFacts}>
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <SubjectDetails
              key={detail.lesson.id}
              lesson={detail.lesson}
              locale={locale}
              semester={semester}
            />
            {detail.own && detail.lesson.course && !detail.draft && (
              <a
                className={`${s.button} ${s.secondary}`}
                href={`/?${new URLSearchParams({ view: "subjects", course: detail.lesson.course })}`}
              >
                {subjectCopy[locale].open}
              </a>
            )}
            <section className={s.lessonAttendees} aria-label={t.attendees}>
              <h3>
                {t.attendees} <span>{detail.attendees.length}</span>
              </h3>
              <ul className={s.attendeeList}>
                {detail.attendees.map((p) => (
                  <li className={s.lessonAttendee} key={p.id}>
                    <PersonLink person={p}>
                      <Avatar person={p} small />
                      <span className={s.attendeeName}>
                        {p.name || p.username}
                      </span>
                    </PersonLink>
                  </li>
                ))}
              </ul>
            </section>
            {detail.lesson.note && (
              <p className={s.eventNote}>
                {typeof detail.lesson.note === "string"
                  ? detail.lesson.note
                  : localizedText(detail.lesson.note, locale)}
              </p>
            )}
            {detail.lesson.personalId && detail.own && (
              <button
                className={`${s.button} ${s.secondary}`}
                onClick={() => {
                  close();
                  onEditEvent(detail.lesson.personalId);
                }}
              >
                {t.editPersonal}
              </button>
            )}
            {detail.draft && <p className={s.hint}>{t.plannerIntro}</p>}
          </div>
        </>
      )}
    </dialog>
  );
}
