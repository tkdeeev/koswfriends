"use client";
import { useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  commonLessons,
  daySegments,
  semesterWindow,
  ZONE,
} from "@/lib/calendar";
import type { Calendar, Choice, Friend, Lesson, Me } from "@/lib/types";
import type { Locale, Text } from "@/lib/i18n";
import s from "./Workspace.module.css";
type Display = {
  lesson: Lesson;
  attendees: string[];
  own: boolean;
  draft: boolean;
};
export default function CalendarView({
  me,
  calendars,
  friends,
  selected,
  setSelected,
  choices,
  locale,
  t,
  onFriends,
}: {
  me: Me;
  calendars: Calendar[];
  friends: Friend[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  choices: Choice[];
  locale: Locale;
  t: Text;
  onFriends: () => void;
}) {
  const [date, setDate] = useState(() => {
    const now = DateTime.now().setZone(ZONE).startOf("day");
    const window =
      calendars.find((c) => c.userId === me.id)?.semester ||
      semesterWindow(me.semester);
    return now.toMillis() >= Date.parse(window.from) &&
      now.toMillis() < Date.parse(window.to)
      ? now
      : DateTime.fromISO(window.from).setZone(ZONE).startOf("day");
  });
  const [onlyShared, setOnlyShared] = useState(false);
  const [drafts, setDrafts] = useState(false);
  const [detail, setDetail] = useState<Display | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const week = date.startOf("week");
  const days = Array.from({ length: 7 }, (_, i) =>
    week.plus({ days: i }).setLocale(locale),
  );
  const now = DateTime.now().setZone(ZONE);
  const own = calendars.find((c) => c.userId === me.id);
  const displays = useMemo(() => {
    const map = new Map<string, Display>();
    const friendEvents = calendars
      .filter((c) => c.userId !== me.id)
      .flatMap((c) => c.events);
    const common = new Set(
      commonLessons(own?.events || [], friendEvents).map((e) => e.id),
    );
    for (const calendar of calendars)
      for (const event of calendar.events) {
        if (onlyShared && !common.has(event.id)) continue;
        if (
          Date.parse(event.end) <= week.toMillis() ||
          Date.parse(event.start) >= week.plus({ days: 7 }).toMillis()
        )
          continue;
        const prev = map.get(event.id);
        if (prev) {
          prev.attendees.push(calendar.username);
          prev.own ||= calendar.userId === me.id;
        } else
          map.set(event.id, {
            lesson: event,
            attendees: [calendar.username],
            own: calendar.userId === me.id,
            draft: false,
          });
      }
    if (drafts && !onlyShared)
      for (const event of choices.flatMap((c) => c.events)) {
        if (
          map.has(event.id) ||
          Date.parse(event.end) <= week.toMillis() ||
          Date.parse(event.start) >= week.plus({ days: 7 }).toMillis()
        )
          continue;
        map.set(event.id, {
          lesson: event,
          attendees: [me.username],
          own: true,
          draft: true,
        });
      }
    return [...map.values()];
  }, [
    calendars,
    own,
    me.id,
    me.username,
    choices,
    onlyShared,
    drafts,
    week.toMillis(),
  ]);
  const slices = displays.flatMap((d) =>
    daySegments(d.lesson).map((segment) => ({ ...segment, display: d })),
  );
  const startHour = Math.min(
    8,
    ...slices.map((x) => Math.floor(x.startMinute / 60)),
  );
  const endHour = Math.max(
    20,
    ...slices.map((x) => Math.ceil(x.endMinute / 60)),
  );
  const open = (item: Display) => {
    setDetail(item);
    dialog.current?.showModal();
  };
  const time = (iso: string) =>
    DateTime.fromISO(iso).setZone(ZONE).toFormat("HH:mm");
  const available = friends.filter(
    (f) => f.status === "accepted" && f.receiving.calendar,
  );
  const dayEvents = displays
    .filter((d) =>
      daySegments(d.lesson).some((seg) => seg.date === date.toISODate()),
    )
    .sort((a, b) => Date.parse(a.lesson.start) - Date.parse(b.lesson.start));
  return (
    <div className={s.workspace}>
      <aside className={s.sidebar}>
        <div className={s.sidebarSection}>
          <h2>{t.yourCalendar}</h2>
          <label className={s.check}>
            <input type="checkbox" checked disabled />
            <span>{me.username}</span>
          </label>
          <p className={s.hint}>
            {own?.lastSuccess
              ? `${t.synced}: ${DateTime.fromISO(own.lastSuccess).setZone(ZONE).setLocale(locale).toLocaleString(DateTime.DATETIME_SHORT)}`
              : t.neverSynced}
          </p>
        </div>
        <div className={s.sidebarSection}>
          <details open>
            <summary>{t.compare}</summary>
            <div className={s.sidebarDetails}>
              {available.map((f) => (
                <label className={s.check} key={f.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, f.id]
                          : selected.filter((id) => id !== f.id),
                      )
                    }
                  />
                  <span>{f.username}</span>
                </label>
              ))}
              {!available.length && <p className={s.hint}>{t.noFriendsBody}</p>}
              <button className={s.quiet} onClick={onFriends}>
                + {t.addFriend}
              </button>
            </div>
          </details>
        </div>
        <div className={s.sidebarSection}>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={onlyShared}
              onChange={(e) => setOnlyShared(e.target.checked)}
            />
            <span>{t.commonOnly}</span>
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={drafts}
              onChange={(e) => setDrafts(e.target.checked)}
            />
            <span>{t.showDrafts}</span>
          </label>
        </div>
        <div className={s.sidebarSection}>
          <h2>{t.legend}</h2>
          <div className={s.legendRow}>
            <i className={s.swatch} />
            {t.own}
          </div>
          <div className={s.legendRow}>
            <i className={`${s.swatch} ${s.outlineSwatch}`} />
            {t.friend}
          </div>
          <div className={s.legendRow}>
            <i className={`${s.swatch} ${s.draftSwatch}`} />
            {t.draft}
          </div>
          <p className={s.hint}>{t.prague} · Europe/Prague</p>
        </div>
      </aside>
      <section className={s.calendarArea} aria-label={t.timetable}>
        <div className={s.calendarToolbar}>
          <h2>
            {week.setLocale(locale).toFormat("d. LLL")} –{" "}
            {week.plus({ days: 6 }).setLocale(locale).toFormat("d. LLL yyyy")}
          </h2>
          <div className={s.toolbar}>
            <button
              aria-label={t.previous}
              className={s.iconButton}
              onClick={() => setDate(date.minus({ weeks: 1 }))}
            >
              ‹
            </button>
            <button
              className={`${s.button} ${s.secondary} ${s.small}`}
              onClick={() => setDate(now.startOf("day"))}
            >
              {t.today}
            </button>
            <button
              aria-label={t.next}
              className={s.iconButton}
              onClick={() => setDate(date.plus({ weeks: 1 }))}
            >
              ›
            </button>
          </div>
        </div>
        <div className={s.mobileControls}>
          {days.map((d) => (
            <button
              key={d.toISODate()}
              className={d.hasSame(date, "day") ? s.selectedDay : ""}
              onClick={() => setDate(d)}
            >
              {d.toFormat("ccc")}
              <br />
              {d.day}
            </button>
          ))}
        </div>
        {!displays.length && (
          <div className={s.empty}>
            <div className={s.emptyIcon}>▦</div>
            <h3>{onlyShared ? t.noShared : t.noLessons}</h3>
            <p>{t.noLessonsBody}</p>
          </div>
        )}
        {displays.length > 0 && (
          <div className={s.calendarFrame}>
            <div className={s.dayHeaders}>
              <div />
              {days.map((d) => (
                <div
                  className={`${s.dayHeader} ${d.hasSame(now, "day") ? s.current : ""}`}
                  key={d.toISODate()}
                >
                  {d.toFormat("cccc")}
                  <strong>{d.day}</strong>
                </div>
              ))}
            </div>
            <div
              className={s.gridBody}
              style={{ height: (endHour - startHour) * 60 }}
            >
              <div className={s.timeColumn}>
                {Array.from({ length: endHour - startHour }, (_, i) => (
                  <div
                    className={s.timeTick}
                    key={i}
                    style={{ top: i * 60 + 10 }}
                  >
                    {String(startHour + i).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const events = slices
                  .filter((e) => e.date === d.toISODate())
                  .sort((a, b) => a.startMinute - b.startMinute);
                const placed: ((typeof events)[number] & {
                  column: number;
                  columns: number;
                })[] = [];
                let cluster: typeof placed = [];
                let clusterEnd = -1;
                const finalize = () => {
                  const columns = Math.max(
                    1,
                    ...cluster.map((x) => x.column + 1),
                  );
                  cluster.forEach((x) => (x.columns = columns));
                  cluster = [];
                };
                for (const event of events) {
                  if (event.startMinute >= clusterEnd) finalize();
                  const used = new Set(
                    cluster
                      .filter((x) => x.endMinute > event.startMinute)
                      .map((x) => x.column),
                  );
                  let col = 0;
                  while (used.has(col)) col++;
                  const item = { ...event, column: col, columns: 1 };
                  placed.push(item);
                  cluster.push(item);
                  clusterEnd = Math.max(clusterEnd, event.endMinute);
                }
                finalize();
                return (
                  <div className={s.dayColumn} key={d.toISODate()}>
                    {placed.map(
                      ({
                        display: item,
                        startMinute,
                        endMinute,
                        column,
                        columns,
                      }) => (
                        <button
                          key={item.lesson.id}
                          aria-label={`${item.lesson.course} ${time(item.lesson.start)} ${item.attendees.join(", ")}`}
                          className={`${s.lesson} ${!item.own ? s.friendLesson : ""} ${item.draft ? s.draftLesson : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
                          style={{
                            top: startMinute - startHour * 60,
                            height: Math.max(22, endMinute - startMinute - 2),
                            left: `calc(${(column * 100) / columns}% + 2px)`,
                            width: `calc(${100 / columns}% - 4px)`,
                          }}
                          onClick={() => open(item)}
                        >
                          <b>
                            {item.lesson.course || item.lesson.title[locale]}
                          </b>
                          <span>
                            {time(item.lesson.start)}–{time(item.lesson.end)}
                          </span>
                          <span>
                            {item.lesson.room} · {item.lesson.group}
                          </span>
                          <span>
                            {item.draft
                              ? t.draft
                              : item.attendees.length > 1
                                ? `${t.sharedLesson} · ${item.attendees.length}`
                                : !item.own
                                  ? item.attendees[0]
                                  : t.own}
                          </span>
                          {item.lesson.cancelled && <span>{t.cancelled}</span>}
                        </button>
                      ),
                    )}
                    {d.hasSame(now, "day") &&
                      now.hour >= startHour &&
                      now.hour < endHour && (
                        <div
                          className={s.nowLine}
                          style={{
                            top: now.hour * 60 + now.minute - startHour * 60,
                          }}
                        />
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className={s.mobileAgenda}>
          {dayEvents.map((item) => (
            <button
              key={item.lesson.id}
              className={`${s.agendaEvent} ${!item.own ? s.agendaFriend : ""} ${item.draft ? s.agendaDraft : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
              onClick={() => open(item)}
            >
              <div className={s.agendaTime}>
                {time(item.lesson.start)}
                <br />
                {time(item.lesson.end)}
              </div>
              <div>
                <b>{item.lesson.course || item.lesson.title[locale]}</b>
                <span>
                  {item.lesson.room} · {item.lesson.group}
                  <br />
                  {item.draft ? t.draft : item.attendees.join(", ")}
                  {item.lesson.cancelled ? ` · ${t.cancelled}` : ""}
                </span>
              </div>
            </button>
          ))}
          {displays.length > 0 && !dayEvents.length && (
            <div className={s.empty}>
              <p>{t.noLessons}</p>
            </div>
          )}
        </div>
      </section>
      <dialog ref={dialog}>
        <div className={s.dialogTitle}>
          <h2>{detail?.lesson.course || t.lesson}</h2>
          <button
            className={s.iconButton}
            onClick={() => dialog.current?.close()}
            aria-label={t.close}
          >
            ×
          </button>
        </div>
        {detail && (
          <>
            <p>{detail.lesson.title[locale]}</p>
            {detail.lesson.cancelled && (
              <p className={`${s.banner} ${s.warning}`}>{t.cancelled}</p>
            )}
            <dl className={s.details}>
              <dt>{t.day}</dt>
              <dd>
                {DateTime.fromISO(detail.lesson.start)
                  .setZone(ZONE)
                  .setLocale(locale)
                  .toLocaleString(DateTime.DATE_FULL)}
              </dd>
              <dt>{t.prague}</dt>
              <dd>
                {time(detail.lesson.start)}–{time(detail.lesson.end)}
              </dd>
              <dt>{t.group}</dt>
              <dd>{detail.lesson.group || "—"}</dd>
              <dt>{t.type}</dt>
              <dd>{detail.lesson.type || "—"}</dd>
              <dt>{t.room}</dt>
              <dd>{detail.lesson.room || "—"}</dd>
              <dt>{t.attendees}</dt>
              <dd>{detail.attendees.join(", ")}</dd>
            </dl>
            {detail.draft && <p className={s.hint}>{t.plannerIntro}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}
