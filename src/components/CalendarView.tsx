"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { DateTime } from "luxon";
import { daySegments, semesterWindow, ZONE } from "@/lib/calendar";
import type { Calendar, Choice, Lesson, Me, Person } from "@/lib/types";
import { lessonType, type Locale, type Text } from "@/lib/i18n";
import { lessonColor } from "@/lib/appearance";
import { arrangeDay } from "@/lib/timetable-layout";
import { PERSONAL_COLOR } from "@/lib/personal-events";
import Avatar, { AvatarStack } from "./Avatar";
import s from "./Workspace.module.css";
type Display = {
  lesson: Lesson;
  attendees: Person[];
  own: boolean;
  draft: boolean;
};
const SCALE = 1.4;
const colorStyle = (type: string, custom?: string) =>
  ({ "--lesson-color": custom || lessonColor(type) }) as CSSProperties;
export default function CalendarView({
  me,
  calendars,
  people,
  attendees,
  selected,
  allOverlays,
  toggleAll,
  setSelected,
  choices,
  locale,
  t,
  onFriends,
  onEditEvent,
}: {
  me: Me;
  calendars: Calendar[];
  people: Person[];
  attendees: Record<string, Person[]>;
  selected: string[];
  allOverlays: boolean;
  toggleAll: (checked: boolean) => void;
  setSelected: (ids: string[]) => void;
  choices: Choice[];
  locale: Locale;
  t: Text;
  onFriends: () => void;
  onEditEvent: (id?: string) => void;
}) {
  const [date, setDate] = useState<DateTime>(() => {
    const now = DateTime.now().setZone(ZONE).startOf("day");
    const window =
      calendars.find((c) => c.userId === me.id)?.semester ||
      semesterWindow(me.semester);
    return now.toMillis() >= Date.parse(window.from) &&
      now.toMillis() < Date.parse(window.to)
      ? now
      : DateTime.fromISO(window.from).setZone(ZONE).startOf("day");
  });
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const navigateDate = (next: DateTime) => {
    setDate(next);
    setExpandedDate(null);
  };
  const expandDay = (day: string) => {
    setExpandedDate(day);
    dayButtons.current.get(day)?.focus();
  };
  const collapseDay = () => {
    if (expandedDate) dayButtons.current.get(expandedDate)?.focus();
    setExpandedDate(null);
  };
  const [onlyShared, setOnlyShared] = useState(false);
  const [drafts, setDrafts] = useState(false);
  const [detail, setDetail] = useState<Display | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const week = date.startOf("week");
  const now = DateTime.now().setZone(ZONE);
  const own = calendars.find((c) => c.userId === me.id);
  const displays = useMemo(() => {
    const map = new Map<string, Display>();
    for (const calendar of calendars) {
      if (calendar.userId !== me.id && !selected.includes(calendar.userId))
        continue;
      for (const event of calendar.events) {
        if (
          Date.parse(event.end) <= week.toMillis() ||
          Date.parse(event.start) >= week.plus({ days: 7 }).toMillis()
        )
          continue;
        const person = {
          id: calendar.userId,
          username: calendar.username,
          name: calendar.name,
        };
        const item = map.get(event.id) || {
          lesson: event,
          attendees: [],
          own: false,
          draft: false,
        };
        item.own ||= calendar.userId === me.id;
        if (calendar.userId === me.id) item.lesson = event;
        const matches =
          calendar.userId === me.id && !event.cancelled
            ? attendees[event.id] || []
            : [];
        item.attendees = [
          ...new Map(
            [...item.attendees, person, ...matches].map((p) => [p.id, p]),
          ).values(),
        ];
        map.set(event.id, item);
      }
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
          attendees: [me],
          own: true,
          draft: true,
        });
      }
    return [...map.values()].filter(
      (item) =>
        !onlyShared ||
        (item.own && !item.lesson.cancelled && item.attendees.length > 1),
    );
  }, [
    calendars,
    attendees,
    selected,
    me,
    choices,
    onlyShared,
    drafts,
    week.toMillis(),
  ]);
  useEffect(() => {
    if (!detail) return;
    const current = displays.find(
      (item) => item.lesson.id === detail.lesson.id,
    );
    if (!current) {
      dialog.current?.close();
      setDetail(null);
    } else setDetail(current);
  }, [displays, detail?.lesson.id]);
  const slices = displays.flatMap((d) =>
    daySegments(d.lesson).map((segment) => ({ ...segment, display: d })),
  );
  const days = Array.from({ length: 7 }, (_, i) =>
    week.plus({ days: i }).setLocale(locale),
  ).filter(
    (d) => d.weekday <= 5 || slices.some((e) => e.date === d.toISODate()),
  );
  const activeDay = days.find((d) => d.hasSame(date, "day")) || days[0];
  const startHour = Math.min(
    8,
    ...slices.map((x) => Math.floor(x.startMinute / 60)),
  );
  const endHour = Math.max(
    20,
    ...slices.map((x) => Math.ceil(x.endMinute / 60)),
  );
  const time = (iso: string) =>
    DateTime.fromISO(iso).setZone(ZONE).toFormat("HH:mm");
  const open = (item: Display) => {
    setDetail(item);
    dialog.current?.showModal();
  };
  const expandedDay = days.find((day) => day.toISODate() === expandedDate);
  const arranged = (expandedDay ? [expandedDay] : days).map((day) => {
    const events = slices
      .filter((e) => e.date === day.toISODate())
      .map((e) => ({
        ...e,
        priority: e.display.lesson.cancelled
          ? 3
          : e.display.draft
            ? 2
            : e.display.own
              ? 0
              : 1,
      }))
      .sort(
        (a, b) =>
          Number(b.display.own) - Number(a.display.own) ||
          Number(a.display.draft) - Number(b.display.draft) ||
          a.display.lesson.id.localeCompare(b.display.lesson.id),
      );
    const { visible, overflow } = arrangeDay(
      events,
      expandedDay ? Infinity : 3,
    );
    return { day, placed: visible, overflow };
  });
  const weekGrid = {
    gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))`,
  };
  const gridStyle = expandedDay
    ? {
        gridTemplateColumns: "52px minmax(0, 1fr)",
        minWidth:
          52 + Math.max(1, ...arranged[0].placed.map((p) => p.columns)) * 150,
      }
    : weekGrid;
  const dayEvents = displays
    .filter((d) =>
      daySegments(d.lesson).some((seg) => seg.date === activeDay.toISODate()),
    )
    .sort((a, b) => Date.parse(a.lesson.start) - Date.parse(b.lesson.start));
  const title = (item: Display) =>
    `${item.lesson.course} · ${lessonType(item.lesson.type, locale)} · ${time(item.lesson.start)}–${time(item.lesson.end)} · ${item.lesson.room} · ${item.lesson.group}\n${item.attendees.map((p) => p.username).join(", ")}`;
  return (
    <div className={s.calendarWorkspace}>
      <section className={s.calendarFilters} aria-label={t.legend}>
        <div className={s.filterRow}>
          <div className={s.person}>
            <Avatar person={me} />
            <strong>{t.yourCalendar}</strong>
          </div>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={
                allOverlays ||
                (people.length > 0 &&
                  people.every((p) => selected.includes(p.id)))
              }
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    !allOverlays &&
                    selected.length > 0 &&
                    !people.every((p) => selected.includes(p.id));
              }}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            {t.allOverlays}
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={onlyShared}
              onChange={(e) => setOnlyShared(e.target.checked)}
            />
            {t.commonOnly}
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={drafts}
              onChange={(e) => setDrafts(e.target.checked)}
            />
            {t.showDrafts}
          </label>
          <button
            className={`${s.button} ${s.secondary} ${s.small}`}
            onClick={() => onEditEvent()}
          >
            {t.personalEvents}
          </button>
          <span className={s.syncLabel}>
            {own?.lastSuccess
              ? `${t.synced}: ${DateTime.fromISO(own.lastSuccess).setZone(ZONE).setLocale(locale).toLocaleString(DateTime.DATETIME_SHORT)}`
              : t.neverSynced}
          </span>
        </div>
        <details className={s.overlayPicker}>
          <summary>
            <span>{t.overlay}</span>
            {selected.length ? ` · ${selected.length}` : ""}
          </summary>
          <p className={s.hint}>{t.overlayHint}</p>
          <div className={s.filterRow}>
            {people.map((person) => (
              <label className={s.personChip} key={person.id}>
                <input
                  type="checkbox"
                  aria-label={person.username}
                  checked={selected.includes(person.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, person.id]
                        : selected.filter((id) => id !== person.id),
                    )
                  }
                />
                <Avatar person={person} small />
                <span>{person.username}</span>
              </label>
            ))}
            {selected.length > 0 && (
              <button className={s.quiet} onClick={() => setSelected([])}>
                {t.clearOverlay}
              </button>
            )}
            <button className={s.quiet} onClick={onFriends}>
              + {t.addFriend}
            </button>
          </div>
        </details>
      </section>
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
              onClick={() => navigateDate(date.minus({ weeks: 1 }))}
            >
              ‹
            </button>
            <button
              className={`${s.button} ${s.secondary} ${s.small}`}
              onClick={() => navigateDate(now.startOf("day"))}
            >
              {t.today}
            </button>
            <button
              aria-label={t.next}
              className={s.iconButton}
              onClick={() => navigateDate(date.plus({ weeks: 1 }))}
            >
              ›
            </button>
          </div>
        </div>
        <div className={s.typeLegend}>
          {["lecture", "tutorial", "laboratory", "exam"].map((type) => (
            <span key={type}>
              <i style={{ background: lessonColor(type) }} />
              {lessonType(type, locale)}
            </span>
          ))}
          <span>
            <i style={{ background: PERSONAL_COLOR }} />
            {t.personalType}
          </span>
          <span className={s.muted}>{t.prague}</span>
        </div>
        <div
          className={`${s.mobileControls} ${s.dayPicker}`}
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          {days.map((d) => (
            <button
              key={d.toISODate()}
              className={d.hasSame(activeDay, "day") ? s.selectedDay : ""}
              onClick={() => navigateDate(d)}
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
        <div
          className={s.calendarFrame}
          onKeyDown={(e) => {
            if (e.key === "Escape" && expandedDay) {
              e.preventDefault();
              collapseDay();
            }
          }}
        >
          <div className={s.dayHeaders} style={weekGrid}>
            <div />
            {days.map((d) => (
              <button
                className={`${s.dayHeader} ${d.hasSame(now, "day") ? s.current : ""} ${d.toISODate() === expandedDay?.toISODate() ? s.expandedDayHeader : ""}`}
                key={d.toISODate()}
                data-date={d.toISODate()}
                ref={(el) => {
                  if (el) dayButtons.current.set(d.toISODate()!, el);
                  else dayButtons.current.delete(d.toISODate()!);
                }}
                aria-label={`${t.expandDay}: ${d.toFormat("cccc d. LLL")}`}
                aria-expanded={d.toISODate() === expandedDay?.toISODate()}
                aria-controls="week-timetable"
                title={t.expandDay}
                onClick={() =>
                  d.toISODate() === expandedDay?.toISODate()
                    ? collapseDay()
                    : expandDay(d.toISODate()!)
                }
              >
                <span className={s.dayName}>{d.toFormat("cccc")}</span>
                <strong>{d.day}</strong>
                <span className={s.expandDayIcon} aria-hidden>
                  ↔
                </span>
              </button>
            ))}
          </div>
          {expandedDay && (
            <div className={s.expandedDayToolbar}>
              <h3>{expandedDay.toFormat("cccc d. LLL yyyy")}</h3>
              <button
                className={`${s.button} ${s.secondary} ${s.small}`}
                onClick={collapseDay}
              >
                {t.backToWeek}
              </button>
            </div>
          )}
          <div className={s.dayScroll}>
            <div
              id="week-timetable"
              className={s.gridBody}
              style={{
                ...gridStyle,
                height: (endHour - startHour) * 60 * SCALE,
              }}
            >
              <div className={s.timeColumn}>
                {Array.from({ length: endHour - startHour }, (_, i) => (
                  <div
                    className={s.timeTick}
                    key={i}
                    style={{ top: i * 60 * SCALE + 10 }}
                  >
                    {String(startHour + i).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {arranged.map(({ day, placed, overflow }) => (
                <div
                  className={s.dayColumn}
                  key={day.toISODate()}
                  data-day-column={day.toISODate()}
                >
                  {placed.map(
                    ({
                      display: item,
                      startMinute,
                      endMinute,
                      column,
                      columns,
                    }) => {
                      const height = Math.max(
                        22,
                        (endMinute - startMinute) * SCALE - 3,
                      );
                      const peers = item.attendees.filter(
                        (p) => p.id !== me.id,
                      );
                      return (
                        <button
                          key={item.lesson.id}
                          aria-label={`${item.lesson.course} ${time(item.lesson.start)} ${item.attendees.map((p) => p.username).join(", ")}`}
                          title={`${title(item)}\n${t.allDetails}`}
                          data-lesson-type={item.lesson.type}
                          className={`${s.lesson} ${!item.own ? s.friendLesson : ""} ${item.draft ? s.draftLesson : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
                          style={{
                            ...colorStyle(item.lesson.type, item.lesson.color),
                            top: (startMinute - startHour * 60) * SCALE,
                            height,
                            left: `calc(${(column * 100) / columns}% + 3px)`,
                            width: `calc(${100 / columns}% - 6px)`,
                          }}
                          onClick={() => open(item)}
                        >
                          <b>
                            {item.lesson.course || item.lesson.title[locale]}
                          </b>
                          {height >= 44 && (
                            <span className={s.lessonTime}>
                              {time(item.lesson.start)}–{time(item.lesson.end)}
                            </span>
                          )}
                          {height >= 100 && (
                            <span className={s.lessonMeta}>
                              {item.lesson.room}
                              {item.lesson.group
                                ? ` · ${item.lesson.group}`
                                : ""}
                            </span>
                          )}
                          {height >= 120 && (
                            <span className={s.lessonKind}>
                              {item.draft
                                ? t.draft
                                : lessonType(item.lesson.type, locale)}
                              {item.lesson.cancelled ? ` · ${t.cancelled}` : ""}
                            </span>
                          )}
                          {height >= 80 && peers.length > 0 && (
                            <AvatarStack people={peers} />
                          )}
                        </button>
                      );
                    },
                  )}
                  {overflow.map((more) => (
                    <button
                      key={more.startMinute}
                      className={s.lessonOverflow}
                      aria-label={`${t.expandDay}: ${day.toFormat("cccc d. LLL")} · ${more.count} ${t.moreLessons}`}
                      title={`${more.count} ${t.moreLessons} · ${t.expandDay}`}
                      style={{
                        top: (more.startMinute - startHour * 60) * SCALE,
                        height: Math.max(
                          22,
                          (more.endMinute - more.startMinute) * SCALE - 3,
                        ),
                        left: `calc(${(more.column * 100) / more.columns}% + 3px)`,
                        width: `calc(${100 / more.columns}% - 6px)`,
                      }}
                      onClick={() => expandDay(day.toISODate()!)}
                    >
                      <strong>+{more.count}</strong>
                      <span>{t.moreLessons}</span>
                    </button>
                  ))}
                  {day.hasSame(now, "day") &&
                    now.hour >= startHour &&
                    now.hour < endHour && (
                      <div
                        className={s.nowLine}
                        style={{
                          top:
                            (now.hour * 60 + now.minute - startHour * 60) *
                            SCALE,
                        }}
                      />
                    )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={s.mobileAgenda}>
          {dayEvents.map((item) => (
            <button
              key={item.lesson.id}
              className={`${s.agendaEvent} ${!item.own ? s.agendaFriend : ""} ${item.draft ? s.agendaDraft : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
              style={colorStyle(item.lesson.type, item.lesson.color)}
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
                  {lessonType(item.lesson.type, locale)} · {item.lesson.room} ·{" "}
                  {item.lesson.group}
                  {item.lesson.cancelled ? ` · ${t.cancelled}` : ""}
                </span>
                <AvatarStack
                  people={item.attendees.filter((p) => p.id !== me.id)}
                />
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
      <dialog ref={dialog} onClose={() => setDetail(null)}>
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
              <dd>{lessonType(detail.lesson.type, locale) || "—"}</dd>
              <dt>{t.room}</dt>
              <dd>{detail.lesson.room || "—"}</dd>
              <dt>{t.attendees}</dt>
              <dd className={s.attendeeList}>
                {detail.attendees.map((p) => (
                  <span className={s.person} key={p.id}>
                    <Avatar person={p} />
                    <span>
                      {p.name || p.username}
                      {p.name && p.name !== p.username && (
                        <small>{p.username}</small>
                      )}
                    </span>
                  </span>
                ))}
              </dd>
            </dl>
            {detail.lesson.note && (
              <p className={s.eventNote}>{detail.lesson.note}</p>
            )}
            {detail.lesson.personalId && detail.own && (
              <button
                className={s.button}
                onClick={() => {
                  dialog.current?.close();
                  onEditEvent(detail.lesson.personalId);
                }}
              >
                {t.editPersonal}
              </button>
            )}
            {detail.draft && <p className={s.hint}>{t.plannerIntro}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}
