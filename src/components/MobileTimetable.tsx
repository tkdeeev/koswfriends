import type { CSSProperties } from "react";
import { DateTime } from "luxon";
import { avatarColor, displayName, lessonColor } from "@/lib/appearance";
import { ZONE } from "@/lib/calendar";
import { arrangeDay, joinAdjacentLessons } from "@/lib/timetable-layout";
import { localizedText, lessonType, type Locale, type Text } from "@/lib/i18n";
import type { Person } from "@/lib/types";
import type { Display } from "./CalendarView";
import Avatar, { AvatarStack } from "./Avatar";
import s from "./Workspace.module.css";

const SCALE = 1.4;
type Slice = { startMinute: number; endMinute: number; display: Display };

/** The clock lives outside the horizontal scroller. All columns share its time scale. */
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
  const height = (endHour - startHour) * 60 * SCALE;
  const arranged = lanes.map((lane) => ({
    ...lane,
    placed: arrangeDay(
      lane.events.map((event) => ({
        ...event,
        id: event.display.lesson.id,
        cancelled: event.display.lesson.cancelled,
        draft: event.display.draft,
      })),
      Infinity,
    ).visible,
  }));
  const cards = joinAdjacentLessons(arranged.map((lane) => lane.placed));
  const widths = arranged.map(
    (lane) => Math.max(1, ...lane.placed.map((p) => p.columns)) * 116,
  );
  const gridTemplateColumns = widths
    .map((width) => `minmax(${width}px, 1fr)`)
    .join(" ");
  const time = (iso: string) =>
    DateTime.fromISO(iso).setZone(ZONE).toFormat("HH:mm");
  const now = DateTime.now().setZone(ZONE);
  if (!lanes.length) return null;
  return (
    <div id="week-timetable" className={s.mobileTimetable} data-layout="people">
      <div className={s.fixedClock}>
        <div className={s.laneClock} aria-hidden />
        <div className={s.mobileTimeAxis} style={{ height }}>
          {Array.from({ length: endHour - startHour }, (_, i) => (
            <span key={i} style={{ top: i * 60 * SCALE }}>
              {String(startHour + i).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
      <div
        className={s.peopleScroller}
        role="region"
        aria-label={t.comparePeople}
        tabIndex={0}
      >
        <div
          className={s.peopleCanvas}
          style={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}
        >
          <div className={s.laneHeaders} style={{ gridTemplateColumns }}>
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
            style={{ gridTemplateColumns, height }}
          >
            {arranged.map(({ person }, lane) => (
              <div
                key={person.id}
                className={s.personLane}
                data-person-lane={person.id}
                style={{ gridColumn: lane + 1, gridRow: 1 }}
              />
            ))}
            {cards.map(
              ({
                event: {
                  display: item,
                  startMinute,
                  endMinute,
                  column,
                  columns,
                },
                lane,
                span,
                continuesBefore,
                continuesAfter,
              }) => {
                const participants = arranged.slice(lane, lane + span);
                const own = participants.some((p) => p.own);
                const shared =
                  !item.lesson.cancelled &&
                  !item.draft &&
                  item.attendees.length > 1;
                const cardPeople = own
                  ? item.attendees.filter((p) => p.id !== me.id)
                  : item.attendees;
                const cardHeight = Math.max(
                  20,
                  (endMinute - startMinute) * SCALE - 3,
                );
                const peopleLabel = item.attendees.map(displayName).join(", ");
                return (
                  <button
                    key={`${item.lesson.id}:${participants[0].person.id}`}
                    data-event-id={item.lesson.id}
                    data-owned={own}
                    data-shared={shared}
                    data-lane-span={span}
                    data-continues-before={continuesBefore}
                    data-continues-after={continuesAfter}
                    data-participants={participants
                      .map((p) => p.person.id)
                      .join(" ")}
                    className={`${s.lesson} ${s.mobileLesson} ${own ? "" : s.friendLesson} ${span > 1 ? s.joinedLesson : ""} ${item.draft ? s.draftLesson : ""} ${item.lesson.cancelled ? s.cancelled : ""}`}
                    aria-label={`${time(item.lesson.start)}–${time(item.lesson.end)} ${item.lesson.course || localizedText(item.lesson.title, locale)} · ${own ? t.you + ": " : ""}${peopleLabel}`}
                    title={`${localizedText(item.lesson.title, locale)} · ${item.lesson.room} · ${peopleLabel}`}
                    style={
                      {
                        "--lesson-color":
                          item.lesson.color || lessonColor(item.lesson.type),
                        gridColumn: `${lane + 1} / span ${span}`,
                        top: (startMinute - startHour * 60) * SCALE,
                        height: cardHeight,
                        left: `calc(${(column * 100) / columns}% + 3px)`,
                        width: `calc(${100 / columns}% - 6px)`,
                      } as CSSProperties
                    }
                    onClick={() => open(item)}
                  >
                    {/* Native sticky edges move with the compositor. The solid outer caps cover
                      them at the true ends, so only clipped/continuing edges appear dashed. */}
                    <span
                      className={`${s.lessonEdge} ${s.lessonEdgeLeft}`}
                      aria-hidden
                    />
                    <div className={s.mobileLessonContent}>
                      <b>
                        {item.lesson.course ||
                          localizedText(item.lesson.title, locale)}
                      </b>
                      {cardHeight >= 42 && (
                        <span className={s.lessonTime}>
                          {time(item.lesson.start)}–{time(item.lesson.end)}
                        </span>
                      )}
                      {cardHeight >= 74 && cardPeople.length > 0 && (
                        <span className={s.sharedPeople}>
                          <AvatarStack
                            people={cardPeople}
                            limit={span > 1 || lanes.length === 1 ? 3 : 2}
                          />
                        </span>
                      )}
                      {cardHeight >= (cardPeople.length ? 110 : 64) && (
                        <span className={s.lessonMeta}>{item.lesson.room}</span>
                      )}
                      {cardHeight >= (cardPeople.length ? 140 : 90) && (
                        <span className={s.lessonKind}>
                          {item.draft
                            ? t.draft
                            : lessonType(item.lesson.type, locale)}
                          {item.lesson.cancelled ? ` · ${t.cancelled}` : ""}
                        </span>
                      )}
                    </div>
                    <span
                      className={`${s.lessonEdge} ${s.lessonEdgeRight}`}
                      aria-hidden
                    />
                  </button>
                );
              },
            )}
            {day.hasSame(now, "day") &&
              now.hour >= startHour &&
              now.hour < endHour && (
                <div
                  className={`${s.nowLine} ${s.mobileNowLine}`}
                  style={{
                    top: (now.hour * 60 + now.minute - startHour * 60) * SCALE,
                  }}
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
