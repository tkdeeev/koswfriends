"use client";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import type { Me, Person, Lesson } from "@/lib/types";
import type { Availability, PersonOverview } from "@/lib/availability";
import { dailyCopy } from "@/lib/daily-copy";
import { localizedText, type Locale, type Text } from "@/lib/i18n";
import { displayName } from "@/lib/appearance";
import { ZONE, currentSemester } from "@/lib/calendar";
import Avatar from "./Avatar";
import LessonDialog from "./LessonDialog";
import type { Display } from "./CalendarView";
import s from "./Daily.module.css";
import { PeopleContext } from "./PeopleContext";
function duration(iso: string, now: number, locale: Locale) {
  const minutes = Math.max(1, Math.ceil((Date.parse(iso) - now) / 60000));
  const t = dailyCopy[locale];
  if (minutes >= 24 * 60) return dateTime(iso, locale);
  return minutes < 60
    ? `${minutes} ${t.minutes}`
    : `${Math.floor(minutes / 60)} ${t.hours}${minutes % 60 ? ` ${minutes % 60} ${t.minutes}` : ""}`;
}
function dateTime(iso: string, locale: Locale) {
  const d = DateTime.fromISO(iso).setZone(ZONE).setLocale(locale);
  return d.hasSame(DateTime.now().setZone(ZONE), "day")
    ? d.toFormat("HH:mm")
    : d.toFormat("ccc d. LLL HH:mm");
}
export function statusText(a: Availability, locale: Locale, now: number) {
  const t = dailyCopy[locale];
  if (a.state === "unknown") return t.unknown;
  if (a.state === "private") return t.private;
  if (a.state === "busy")
    return `${t.now} · ${t.availableIn.toLowerCase()} ${duration(a.freeAt!, now, locale)}`;
  if (a.state === "soon" && a.next)
    return `${t.startsIn} ${duration(a.next.start, now, locale)}`;
  return a.freeUntil
    ? `${t.free} · ${t.until} ${dateTime(a.freeUntil, locale)}`
    : t.noMore;
}

export function PeopleProvider({
  me,
  locale,
  t,
  children,
  onEditEvent,
}: {
  me: Me | null | undefined;
  locale: Locale;
  t: Text;
  children: ReactNode;
  onEditEvent: (id?: string) => void;
}) {
  const [people, setPeople] = useState<PersonOverview[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!me) {
      setPeople([]);
      setPerson(null);
      return;
    }
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/people", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!disposed) {
          setPeople(data.people);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) setPeople([]);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [me?.id]);
  return (
    <PeopleContext.Provider value={{ people, open: setPerson, locale, now }}>
      {children}
      {person && me && (
        <PersonDialog
          key={person.id}
          person={person}
          me={me}
          locale={locale}
          t={t}
          close={() => setPerson(null)}
          onEditEvent={onEditEvent}
        />
      )}
    </PeopleContext.Provider>
  );
}

export function PersonLink({
  person,
  children,
  status = false,
  disabled = false,
  className = "",
}: {
  person: Person;
  children: ReactNode;
  status?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const context = useContext(PeopleContext);
  const availability = context.people.find(
    (p) => p.person.id === person.id,
  )?.availability;
  if (disabled)
    return <span className={`${s.identity} ${className}`}>{children}</span>;
  return (
    <button
      type="button"
      className={`${s.personLink} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        context.open(person);
      }}
      aria-label={`${dailyCopy[context.locale].profile}: ${displayName(person)}`}
    >
      <span>
        {children}
        {status && availability && (
          <small data-state={availability.state}>
            {statusText(availability, context.locale, context.now)}
          </small>
        )}
      </span>
    </button>
  );
}

function PersonDialog({
  person,
  me,
  locale,
  t,
  close,
  onEditEvent,
}: {
  person: Person;
  me: Me;
  locale: Locale;
  t: Text;
  close: () => void;
  onEditEvent: (id?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [profile, setProfile] = useState<PersonOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<Display | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const r = await fetch(`/api/people?id=${person.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!disposed) {
          setProfile(d.people[0]);
          setFailed(false);
          setNow(Date.now());
          setDetail((old) =>
            old &&
            [...d.people[0].availability.current, d.people[0].availability.next]
              .filter(Boolean)
              .some((l: Lesson) => l.id === old.lesson.id)
              ? old
              : null,
          );
        }
      } catch {
        if (!disposed) {
          setProfile(null);
          setDetail(null);
          setFailed(true);
        }
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [person.id]);
  const a = profile?.availability;
  const c = dailyCopy[locale];
  const open = (lesson: Lesson) =>
    setDetail({
      lesson,
      attendees: [profile?.person || person],
      own: person.id === me.id,
      draft: false,
    });
  return (
    <>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="person-title"
        onClose={close}
      >
        <div className={s.heading}>
          <div className={s.identity}>
            <Avatar person={profile?.person || person} />
            <div>
              <h2 id="person-title">
                {displayName(profile?.person || person)}
              </h2>
              <small className={s.muted}>@{person.username}</small>
            </div>
          </div>
          <button
            className={s.close}
            onClick={close}
            aria-label={c.close}
            autoFocus
          >
            ×
          </button>
        </div>
        {!a ? (
          <p role="status">{failed ? c.unknown : t.loading}</p>
        ) : (
          <>
            <div className={s.availability}>
              <strong>{statusText(a, locale, now)}</strong>
              {a.freeAt && (
                <span>
                  {c.until} {dateTime(a.freeAt, locale)}
                </span>
              )}
              <small className={s.status}>{c.basedOn}</small>
            </div>
            {a.current.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                label={c.now}
                locale={locale}
                open={open}
              />
            ))}
            {a.next && (
              <LessonRow
                lesson={a.next}
                label={c.next}
                locale={locale}
                open={open}
              />
            )}
            {a.lastSuccess && (
              <p className={s.muted}>
                {c.synced}: {dateTime(a.lastSuccess, locale)}
              </p>
            )}
          </>
        )}
      </dialog>
      {detail && (
        <LessonDialog
          semester={currentSemester()}
          detail={detail}
          close={() => setDetail(null)}
          locale={locale}
          t={t}
          onEditEvent={(id) => {
            close();
            onEditEvent(id);
          }}
        />
      )}
    </>
  );
}

function LessonRow({
  lesson,
  label,
  locale,
  open,
}: {
  lesson: Lesson;
  label: string;
  locale: Locale;
  open: (lesson: Lesson) => void;
}) {
  return (
    <button className={s.event} onClick={() => open(lesson)}>
      <small>
        {label} · {dateTime(lesson.start, locale)}–
        {DateTime.fromISO(lesson.end).setZone(ZONE).toFormat("HH:mm")}
      </small>
      <strong>{lesson.course || localizedText(lesson.title, locale)}</strong>
      {localizedText(lesson.title, locale)}
      {lesson.room && <small> · {lesson.room}</small>}
    </button>
  );
}

export function NextLessonCard({
  me,
  locale,
  t,
  onEditEvent,
}: {
  me: Me;
  locale: Locale;
  t: Text;
  onEditEvent: (id?: string) => void;
}) {
  const { people, now } = useContext(PeopleContext);
  const [detail, setDetail] = useState<Display | null>(null);
  const a = people.find((p) => p.person.id === me.id)?.availability;
  const lesson = a?.current[0] || a?.next;
  const c = dailyCopy[locale];
  // Never retain a lesson after sharing/data availability changes.
  useEffect(() => {
    if (detail && detail.lesson.id !== lesson?.id) setDetail(null);
  }, [lesson?.id]);
  if (!a || !lesson) return null;
  const attendees = people
    .filter(
      (p) =>
        p.availability.current.some((e) => e.id === lesson.id) ||
        p.availability.next?.id === lesson.id,
    )
    .map((p) => p.person);
  return (
    <>
      <button
        className={s.next}
        aria-label={`${a.current.length ? c.now : c.next}: ${lesson.course || localizedText(lesson.title, locale)}`}
        onClick={() =>
          setDetail({ lesson, attendees, own: true, draft: false })
        }
      >
        <span>
          <small>{a.current.length ? c.now : c.next}</small>
          <strong>
            {lesson.course || localizedText(lesson.title, locale)}
            {lesson.room && ` · ${lesson.room}`}
          </strong>
        </span>
        <span className={s.nextTime}>
          <strong>{dateTime(lesson.start, locale)}</strong>
          <small>
            {a.current.length
              ? `${c.until} ${dateTime(a.freeAt!, locale)}`
              : `${c.startsIn} ${duration(lesson.start, now, locale)}`}
          </small>
        </span>
      </button>
      {detail && (
        <LessonDialog
          semester={currentSemester()}
          detail={{ ...detail, lesson, attendees }}
          close={() => setDetail(null)}
          locale={locale}
          t={t}
          onEditEvent={onEditEvent}
        />
      )}
    </>
  );
}
