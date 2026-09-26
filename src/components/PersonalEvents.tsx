"use client";
import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import type { Me, PersonalEvent, PersonalEventData } from "@/lib/types";
import type { Text } from "@/lib/i18n";
import { semesterWindow, ZONE } from "@/lib/calendar";
import { PERSONAL_COLOR } from "@/lib/personal-events";
import type { Mutate } from "./FriendsView";
import s from "./Workspace.module.css";
const local = (iso: string) =>
  DateTime.fromISO(iso).setZone(ZONE).toFormat("yyyy-MM-dd'T'HH:mm");
export default function PersonalEvents({
  open,
  initialId,
  close,
  events,
  me,
  mutate,
  t,
}: {
  open: boolean;
  initialId?: string;
  close: () => void;
  events: PersonalEvent[];
  me: Me;
  mutate: Mutate;
  t: Text;
}) {
  const fresh = (): PersonalEventData => {
    let start = DateTime.now().setZone(ZONE).startOf("hour").plus({ hours: 1 });
    const window = semesterWindow(me.semester);
    if (
      start.toMillis() < Date.parse(window.from) ||
      start.toMillis() >= Date.parse(window.to)
    )
      start = DateTime.fromISO(window.from).setZone(ZONE).set({ hour: 9 });
    return {
      course: "",
      title: "",
      start: local(start.toISO()!),
      end: local(start.plus({ hours: 1 }).toISO()!),
      room: "",
      color: PERSONAL_COLOR,
      note: "",
      repeatUntil: null,
    };
  };
  const dialog = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState<string>();
  const [value, setValue] = useState<PersonalEventData>(fresh);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const select = (event?: PersonalEvent) => {
    setId(event?.id);
    setValue(
      event
        ? { ...event, start: local(event.start), end: local(event.end) }
        : fresh(),
    );
    setConfirm(false);
    setFailed(false);
  };
  useEffect(() => {
    if (open) {
      select(events.find((e) => e.id === initialId));
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [open, initialId]);
  const change = <K extends keyof PersonalEventData>(
    key: K,
    v: PersonalEventData[K],
  ) => setValue((prev) => ({ ...prev, [key]: v }));
  return (
    <dialog className={s.eventDialog} ref={dialog} onClose={close}>
      <div className={s.dialogTitle}>
        <h2>{t.personalEvents}</h2>
        <button className={s.iconButton} aria-label={t.close} onClick={close}>
          ×
        </button>
      </div>
      <p className={s.hint}>{t.personalHint}</p>
      <div className={s.eventEditor}>
        <aside className={s.eventList}>
          <button
            className={`${s.button} ${s.secondary} ${s.small}`}
            onClick={() => select()}
          >
            {t.addPersonal}
          </button>
          {events.map((event) => (
            <button
              key={event.id}
              className={`${s.eventListItem} ${id === event.id ? s.eventSelected : ""}`}
              onClick={() => select(event)}
            >
              <i style={{ background: event.color }} />
              <span>
                <strong>{event.course}</strong>
                <small>{event.title}</small>
              </span>
            </button>
          ))}
        </aside>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setFailed(false);
            try {
              await mutate(
                "/api/events",
                id
                  ? { id, event: value }
                  : { semester: me.semester, event: value },
                id ? "PATCH" : "POST",
              );
              close();
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{id ? t.editPersonal : t.addPersonal}</h3>
          <div className={s.eventFields}>
            <label className={s.field}>
              {t.courseCode}
              <input
                required
                maxLength={50}
                placeholder="TV1-PE"
                value={value.course}
                onChange={(e) => change("course", e.target.value)}
              />
            </label>
            <label className={s.field}>
              {t.eventTitle}
              <input
                required
                maxLength={160}
                value={value.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </label>
            <label className={s.field}>
              {t.starts}
              <input
                type="datetime-local"
                required
                value={value.start}
                onChange={(e) => change("start", e.target.value)}
              />
            </label>
            <label className={s.field}>
              {t.ends}
              <input
                type="datetime-local"
                required
                min={value.start}
                value={value.end}
                onChange={(e) => change("end", e.target.value)}
              />
            </label>
            <label className={s.field}>
              {t.room}
              <input
                maxLength={100}
                value={value.room}
                onChange={(e) => change("room", e.target.value)}
              />
            </label>
            <label className={s.field}>
              {t.eventColor}
              <input
                type="color"
                value={value.color}
                onChange={(e) => change("color", e.target.value)}
              />
            </label>
          </div>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={!!value.repeatUntil}
              onChange={(e) =>
                change(
                  "repeatUntil",
                  e.target.checked
                    ? DateTime.fromISO(value.start, { zone: ZONE })
                        .plus({ weeks: 12 })
                        .toISODate()!
                    : null,
                )
              }
            />
            {t.weeklyRepeat}
          </label>
          {value.repeatUntil !== null && (
            <label className={s.field}>
              {t.repeatUntil}
              <input
                type="date"
                required
                min={value.start.slice(0, 10)}
                max={DateTime.fromISO(value.start, { zone: ZONE })
                  .plus({ days: 366 })
                  .toISODate()!}
                value={value.repeatUntil}
                onChange={(e) => change("repeatUntil", e.target.value)}
              />
            </label>
          )}
          <label className={s.field}>
            {t.note}
            <textarea
              maxLength={1000}
              rows={2}
              value={value.note}
              onChange={(e) => change("note", e.target.value)}
            />
          </label>
          <p className={s.hint}>{t.personalEditHint}</p>
          {failed && (
            <p role="alert" className={`${s.banner} ${s.error}`}>
              {t.eventSaveError}
            </p>
          )}
          <div className={s.actions}>
            <button className={s.button} disabled={busy}>
              {t.saveEvent}
            </button>
            {id && (
              <button
                type="button"
                className={s.quiet}
                onClick={() => setConfirm(true)}
              >
                {t.deleteEvent}
              </button>
            )}
          </div>
          {confirm && (
            <div className={s.banner}>
              <p>{t.deleteEventConfirm}</p>
              <div className={s.actions}>
                <button
                  type="button"
                  className={`${s.button} ${s.danger} ${s.small}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await mutate("/api/events", { id }, "DELETE");
                      select();
                    } catch {
                      setFailed(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t.confirmDeleteEvent}
                </button>
                <button
                  type="button"
                  className={s.quiet}
                  onClick={() => setConfirm(false)}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </dialog>
  );
}
