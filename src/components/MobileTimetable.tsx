import type { CSSProperties } from "react";
import { DateTime } from "luxon";
import { avatarColor, displayName, lessonColor } from "@/lib/appearance";
import { ZONE } from "@/lib/calendar";
import { arrangeDay } from "@/lib/timetable-layout";
import { lessonType, type Locale, type Text } from "@/lib/i18n";
import type { Person } from "@/lib/types";
import type { Display } from "./CalendarView";
import Avatar, { AvatarStack } from "./Avatar";
import s from "./Workspace.module.css";

const SCALE = 1.4;
type Slice = { startMinute: number; endMinute: number; display: Display };

/** Each person has the same clock. Empty time stays empty, including across lanes. */
export default function MobileTimetable({
  lanes,
  me,
  day,
  locale,
  t,
  open,
}: {
  lanes: { person: Person; own: boolean; events: Slice[] }[];
  me: Person;
  day: DateTime;
  locale: Locale;
  t: Text;
  open: (display: Display) => void;
}) {
  const events = lanes.flatMap((lane) => lane.events);
  const startHour = Math.min(
    8,
    ...events.map((e) => Math.floor(e.startMinute / 60)),
  );
  const endHour = Math.max(
    18,
    ...events.map((e) => Math.ceil(e.endMinute / 60)),
  );
  const arranged = lanes.map((lane) => ({
    ...lane,
    placed: arrangeDay(lane.events, Infinity).visible,
  }));
  const gridTemplateColumns = `40px ${arranged.map((lane) => `minmax(${Math.max(1, ...lane.placed.map((p) => p.columns)) * 116}px, 1fr)`).join(" ")}`;
  const time = (iso: string) =>
    DateTime.fromISO(iso).setZone(ZONE).toFormat("HH:mm");
  const now = DateTime.now().setZone(ZONE);
  if (!lanes.length) return null;
  return (
    <div
      className={s.mobileTimetable}
      role="region"
      aria-label={t.comparePeople}
      tabIndex={0}
    >
      <div className={s.laneHeaders} style={{ gridTemplateColumns }}>
        <div className={s.laneClock}>
          <span>{t.prague}</span>
        </div>
        {arranged.map(({ person, own }) => (
          <div
            className={`${s.laneHeader} ${own ? s.ownLaneHeader : ""}`}
            key={person.id}
            data-person-header={person.id}
            style={
              {
                "--person-color": avatarColor(person.username),
              } as CSSProperties
            }
          >
            <Avatar person={person} small />
            <span title={displayName(person)}>
              {own ? t.you : displayName(person)}
            </span>
          </div>
        ))}
      </div>
      <div
        className={s.mobileTimeGrid}
        style={{
          gridTemplateColumns,
          height: (endHour - startHour) * 60 * SCALE,
        }}
      >
        <div className={s.mobileTimeAxis}>
          {Array.from({ length: endHour - startHour }, (_, i) => (
            <span key={i} style={{ top: i * 60 * SCALE }}>
              {String(startHour + i).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {arranged.map(({ person, own, placed }) => (
          <div
            key={person.id}
            className={s.personLane}
            data-person-lane={person.id}
          >
            {placed.map(
              ({ display: item, startMinute, endMinute, column, columns }) => {
                const peers = item.attendees.filter((p) => p.id !== me.id);
                const height = Math.max(
                  20,
                  (endMinute - startMinute) * SCALE - 3,
                );
                return (
                  <button
                    key={item.lesson.id}
                    data-event-id={item.lesson.id}
                    data-owned={own}
                    className={`${s.lesson} ${s.mobileLesson} ${own ? "" : s.friendLesson} ${item.draft ? s.draftLesson : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
                    aria-label={`${time(item.lesson.start)}–${time(item.lesson.end)} ${item.lesson.course || item.lesson.title[locale]} · ${own ? t.you : displayName(person)}`}
                    title={`${item.lesson.title[locale]} · ${item.lesson.room}`}
                    style={
                      {
                        "--lesson-color":
                          item.lesson.color || lessonColor(item.lesson.type),
                        top: (startMinute - startHour * 60) * SCALE,
                        height,
                        left: `calc(${(column * 100) / columns}% + 3px)`,
                        width: `calc(${100 / columns}% - 6px)`,
                      } as CSSProperties
                    }
                    onClick={() => open(item)}
                  >
                    <b>{item.lesson.course || item.lesson.title[locale]}</b>
                    {height >= 42 && (
                      <span className={s.lessonTime}>
                        {time(item.lesson.start)}–{time(item.lesson.end)}
                      </span>
                    )}
                    {height >= 64 && (
                      <span className={s.lessonMeta}>{item.lesson.room}</span>
                    )}
                    {height >= 90 && (
                      <span className={s.lessonKind}>
                        {item.draft
                          ? t.draft
                          : lessonType(item.lesson.type, locale)}
                        {item.lesson.cancelled ? ` · ${t.cancelled}` : ""}
                      </span>
                    )}
                    {own && height >= 108 && peers.length > 0 && (
                      <AvatarStack people={peers} />
                    )}
                  </button>
                );
              },
            )}
            {day.hasSame(now, "day") &&
              now.hour >= startHour &&
              now.hour < endHour && (
                <div
                  className={s.nowLine}
                  style={{
                    top: (now.hour * 60 + now.minute - startHour * 60) * SCALE,
                  }}
                />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
