"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import type { Calendar, Choice, Lesson, Localized, Me } from "@/lib/types";
import { conflicts, ZONE } from "@/lib/calendar";
import { groupLabel, type Locale, type Text } from "@/lib/i18n";
import type { Mutate } from "./FriendsView";
import s from "./Workspace.module.css";
export type SharedPlan = {
  userId: string;
  username: string;
  choices: Choice[];
};
export type Read = (path: string) => Promise<any>;
function ChoiceCard({
  choice,
  mutate,
  semester,
  t,
  locale,
}: {
  choice: Choice;
  mutate: Mutate;
  semester: string;
  t: Text;
  locale: Locale;
}) {
  const [note, setNote] = useState(choice.note);
  return (
    <article className={s.draftCard}>
      <div className={s.rowHead}>
        <h3>{choice.course}</h3>
        <span
          className={`${s.badge} ${!choice.verified ? s.badgeWarning : ""}`}
        >
          {choice.verified ? t.verified : t.unverified}
        </span>
      </div>
      <p className={s.choiceTitle}>
        {choice.title[locale]}
        {choice.group ? ` · ${groupLabel(choice.group, locale)}` : ""}
      </p>
      <label className={s.field}>
        {t.note}
        <textarea
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className={s.actions}>
        <button
          className={`${s.quiet} ${s.small}`}
          onClick={() =>
            mutate("/api/plans", {
              action: "note",
              semester,
              id: choice.id,
              note,
            }).catch(() => {})
          }
        >
          {t.saveNote}
        </button>
        <button
          className={`${s.quiet} ${s.small}`}
          onClick={() =>
            mutate("/api/plans", {
              action: "remove",
              semester,
              id: choice.id,
            }).catch(() => {})
          }
        >
          {t.remove}
        </button>
      </div>
    </article>
  );
}
export default function PlannerView({
  me,
  choices,
  shared,
  calendars,
  read,
  mutate,
  locale,
  t,
}: {
  me: Me;
  choices: Choice[];
  shared: SharedPlan[];
  calendars: Calendar[];
  read: Read;
  mutate: Mutate;
  locale: Locale;
  t: Text;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { code: string; title: Localized }[] | null
  >(null);
  const [course, setCourse] = useState("");
  const [groups, setGroups] = useState<
    { key: string; events: Lesson[] }[] | null
  >(null);
  const [group, setGroup] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const clashes = conflicts([
    ...(calendars.find((c) => c.userId === me.id)?.events || []),
    ...choices.flatMap((c) => c.events),
  ]);
  const select = async (code: string) => {
    setCourse(code);
    setGroup("");
    setGroups(null);
    setBusy(true);
    try {
      const data = await read(
        `/api/course-search?course=${encodeURIComponent(code)}&semester=${me.semester}`,
      );
      setGroups(data.groups);
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.twoColumns}>
      <div className={s.stack}>
        <section className={s.panel}>
          <h2>{t.findCourse}</h2>
          <form
            className={s.inlineForm}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const data = await read(
                  `/api/course-search?q=${encodeURIComponent(query)}`,
                );
                setResults(data.courses);
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className={s.field}>
              {t.searchHint}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder="BI-…"
              />
            </label>
            <button className={s.button} disabled={busy}>
              {t.search}
            </button>
          </form>
          {results?.map((r) => (
            <button
              key={r.code}
              className={s.courseResult}
              onClick={() => select(r.code)}
            >
              <div>
                <b>{r.code}</b>
                <br />
                <span>{r.title[locale]}</span>
              </div>
              <span aria-hidden>↗</span>
            </button>
          ))}
          {results?.length === 0 && <p className={s.hint}>{t.noResults}</p>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await mutate("/api/plans", {
                  action: "add",
                  semester: me.semester,
                  course,
                  group: group || null,
                  note,
                });
                setCourse("");
                setGroups(null);
                setGroup("");
                setNote("");
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3 style={{ marginTop: 28 }}>
              {groups ? t.chooseGroup : t.manual}
            </h3>
            <p className={s.hint}>{t.manualHint}</p>
            <label className={s.field} style={{ marginTop: 14 }}>
              {t.courseCode}
              <input
                required
                value={course}
                maxLength={80}
                pattern="[a-zA-Z0-9.:\-]+"
                onChange={(e) => {
                  setCourse(e.target.value);
                  setGroup("");
                  setGroups(null);
                }}
              />
            </label>
            {groups && (
              <fieldset>
                <legend>{t.chooseGroup}</legend>
                <label className={s.groupChoice}>
                  <input
                    type="radio"
                    name="group"
                    checked={!group}
                    onChange={() => setGroup("")}
                  />
                  {t.unverified}
                </label>
                {groups.map((g) => {
                  const first = g.events.find((e) => !e.cancelled);
                  return (
                    <label className={s.groupChoice} key={g.key}>
                      <input
                        type="radio"
                        name="group"
                        checked={group === g.key}
                        onChange={() => setGroup(g.key)}
                      />
                      <span>
                        <strong>{groupLabel(g.key, locale)}</strong>
                        <br />
                        {first &&
                          `${DateTime.fromISO(first.start).setZone(ZONE).setLocale(locale).toFormat("ccc HH:mm")}–${DateTime.fromISO(first.end).setZone(ZONE).toFormat("HH:mm")} · ${first.room}`}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {groups?.length === 0 && (
              <p className={`${s.banner} ${s.warning}`}>{t.noGroups}</p>
            )}
            <label className={s.field} style={{ marginTop: 14 }}>
              {t.note}
              <textarea
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button className={s.button} disabled={busy || !course}>
              {t.addChoice}
            </button>
          </form>
        </section>
        <section className={s.panel}>
          <h2>
            {t.yourChoices} <span className={s.muted}>/ {choices.length}</span>
          </h2>
          {choices.length ? (
            choices.map((c) => (
              <ChoiceCard
                key={`${c.id}:${c.note}`}
                choice={c}
                mutate={mutate}
                semester={me.semester}
                t={t}
                locale={locale}
              />
            ))
          ) : (
            <div className={s.empty}>
              <h3>{t.noChoices}</h3>
              <p>{t.noChoicesBody}</p>
            </div>
          )}
        </section>
      </div>
      <div className={s.stack}>
        <section className={s.panel}>
          <h2>
            {t.conflicts} <span className={s.muted}>/ {clashes.length}</span>
          </h2>
          <p className={s.hint}>{t.conflictHint}</p>
          {!clashes.length && (
            <p className={s.banner} style={{ marginTop: 16 }}>
              {t.noConflicts}
            </p>
          )}
          {clashes.slice(0, 20).map(([a, b]) => (
            <div className={s.conflict} key={`${a.id}:${b.id}`}>
              <b>
                {a.course} × {b.course}
              </b>
              <br />
              {DateTime.fromISO(a.start)
                .setZone(ZONE)
                .setLocale(locale)
                .toFormat("d. LLL · HH:mm")}{" "}
              / {DateTime.fromISO(b.start).setZone(ZONE).toFormat("HH:mm")}
            </div>
          ))}
        </section>
        <section className={s.panel}>
          <h2>{t.sharedChoices}</h2>
          {!shared.length && (
            <p className={s.muted} style={{ marginTop: 18 }}>
              {t.noSharedPlans}
            </p>
          )}
          {shared.map((p) => (
            <div className={s.sharedPlan} key={p.userId}>
              <strong>{p.username}</strong>
              {!p.choices.length && <p className={s.hint}>{t.noChoices}</p>}
              {p.choices.map((c) => (
                <div className={s.sharedChoice} key={c.id}>
                  {c.course} {c.group && `· ${groupLabel(c.group, locale)}`}
                  <br />
                  <span className={s.hint}>
                    {c.verified ? t.verified : t.unverified}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                  {choices.some((own) => own.course === c.course) && (
                    <div>
                      <span className={s.badge}>{t.commonCourse}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
