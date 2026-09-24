"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy, type Locale } from "@/lib/i18n";
import type { Calendar, Choice, Friend, Grant, Me } from "@/lib/types";
import { semesterOptions } from "@/lib/calendar";
import CalendarView from "./CalendarView";
import FriendsView, { Sharing, type Invite } from "./FriendsView";
import PlannerView, { type SharedPlan } from "./PlannerView";
import s from "./Workspace.module.css";
async function request(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error("offline");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "unavailable");
  return data;
}
export default function Workspace() {
  const [locale, setLocale] = useState<Locale>("cs");
  const t = copy[locale];
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [view, setView] = useState<
    "timetable" | "friends" | "planner" | "account"
  >("timetable");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocked, setBlocked] = useState<{ id: string; username: string }[]>(
    [],
  );
  const [invites, setInvites] = useState<Invite[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [shared, setShared] = useState<SharedPlan[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteFrom, setInviteFrom] = useState("");
  const [giving, setGiving] = useState<Grant>({ calendar: true, plans: false });
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    const saved = localStorage.getItem("kwf_locale");
    setLocale(
      saved === "en" || saved === "cs"
        ? saved
        : navigator.language.startsWith("en")
          ? "en"
          : "cs",
    );
    const params = new URLSearchParams(location.search);
    setInviteToken(params.get("invite") || "");
    setError(params.get("authError") || "");
    if (params.has("authError")) history.replaceState(null, "", "/");
    request("/api/me")
      .then(setMe)
      .catch((e) => {
        setMe(null);
        if (e.message !== "unauthorized") setError(e.message);
      });
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const reload = useCallback(async () => {
    if (!me) return;
    const ticket = ++generation.current;
    try {
      const [f, c, p, user] = await Promise.all([
        request("/api/friends"),
        request(
          `/api/calendar?semester=${me.semester}&friends=${selected.join(",")}`,
        ),
        request(`/api/plans?semester=${me.semester}`),
        request("/api/me"),
      ]);
      if (ticket !== generation.current) return;
      setFriends(f.friends);
      setBlocked(f.blocked);
      setCalendars(c.calendars);
      setChoices(p.choices);
      setShared(p.shared);
      setMe(user);
      if (c.revoked.length) {
        setSelected((prev) => prev.filter((id) => !c.revoked.includes(id)));
        setRevoked(true);
      }
      setError((prev) => (prev === "offline" ? "" : prev));
      if (view === "friends") {
        const i = await request("/api/invites");
        if (ticket === generation.current) setInvites(i.invites);
      }
    } catch (e) {
      if (ticket !== generation.current) return;
      const code = e instanceof Error ? e.message : "unavailable";
      setError(code);
      setCalendars((prev) => prev.filter((c) => c.userId === me.id));
      setShared([]);
      if (code === "unauthorized") {
        setMe(null);
        setCalendars([]);
        setFriends([]);
        setChoices([]);
      }
    }
  }, [me?.id, me?.semester, selected.join(","), view]);
  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (!me || !inviteToken) return;
    request(`/api/invites?token=${encodeURIComponent(inviteToken)}`)
      .then((d) => setInviteFrom(d.username))
      .catch((e) => setError(e.message));
  }, [me?.id, inviteToken]);
  const read = async (path: string) => {
    try {
      setError("");
      return await request(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unavailable");
      throw e;
    }
  };
  const mutate = async (path: string, data: unknown, method = "POST") => {
    try {
      setError("");
      const result = await request(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me?.csrf || "",
        },
        body: JSON.stringify(data),
      });
      if (result.ok === false && result.error) throw new Error(result.error);
      await reload();
      setToast(t.saved);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "unavailable");
      throw e;
    }
  };
  const signIn = `/auth/login${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`;
  const errorMessage =
    error === "offline"
      ? t.offline
      : t.errors[error as keyof typeof t.errors] || t.error;
  const own = calendars.find((c) => c.userId === me?.id);
  return (
    <div className={s.app}>
      <header className={s.header}>
        <a className={s.brand} href="/" aria-label="KOSwFriends">
          <span className={s.mark} aria-hidden>
            K
          </span>
          <span>
            KOS<span>wFriends</span>
          </span>
        </a>
        {me && (
          <nav className={s.navigation} aria-label="Navigation">
            {(["timetable", "friends", "planner"] as const).map((tab) => (
              <button
                key={tab}
                aria-current={view === tab ? "page" : undefined}
                className={`${s.nav} ${view === tab ? s.active : ""}`}
                onClick={() => setView(tab)}
              >
                {t[tab]}
              </button>
            ))}
          </nav>
        )}
        <div className={s.headerEnd}>
          <div className={s.languages} aria-label="Language">
            {(["cs", "en"] as const).map((l) => (
              <button
                key={l}
                className={locale === l ? s.chosen : ""}
                aria-pressed={locale === l}
                onClick={() => {
                  setLocale(l);
                  localStorage.setItem("kwf_locale", l);
                }}
              >
                {l === "cs" ? "CZ" : "EN"}
              </button>
            ))}
          </div>
          {me && (
            <button
              className={s.quiet}
              onClick={() => setView("account")}
              aria-label={t.account}
            >
              <span className={s.identity}>
                <span className={s.avatar}>
                  {me.username.slice(0, 2).toUpperCase()}
                </span>
                {me.username}
              </span>
              <span className={s.mobileControls}>☰</span>
            </button>
          )}
        </div>
      </header>
      {me === undefined ? (
        <div className={s.loading}>{t.loading}</div>
      ) : !me ? (
        <>
          {error && (
            <div
              role="alert"
              className={`${s.banner} ${s.error}`}
              style={{ margin: "20px 6% 0" }}
            >
              {errorMessage}
            </div>
          )}
          <main className={s.hero}>
            <div>
              <div className={s.eyebrow}>{t.school}</div>
              <h1>{t.hero}</h1>
              <p className={s.intro}>{t.intro}</p>
              <a className={s.button} href={signIn}>
                {t.signIn} <span aria-hidden>↗</span>
              </a>
              <p className={s.privacy}>
                <strong>{t.private}</strong>
                <br />
                {t.privacy}
              </p>
            </div>
            <div className={s.previewWrap}>
              <div className={s.preview}>
                <h2>{t.sampleTitle}</h2>
                <div className={s.previewBar}>
                  <span>
                    {t.yourCalendar} + {t.friends.toLowerCase()}
                  </span>
                  <span>‹　{t.week}　›</span>
                </div>
                <div className={s.miniGrid} aria-hidden>
                  {[t.monday, t.tuesday, t.wednesday, t.thursday, t.friday].map(
                    (d, i) => (
                      <div className={s.miniCol} key={d}>
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: 10,
                            color: "#576b78",
                          }}
                        >
                          {d}
                        </div>
                        {i !== 3 && (
                          <div
                            className={`${s.miniEvent} ${i === 2 ? s.miniOutline : i === 4 ? s.miniDraft : ""}`}
                            style={{
                              top: 38 + (i % 3) * 48,
                              height: i === 1 ? 96 : 74,
                            }}
                          >
                            <b>{["MAT", "PRG", "MAT", "", "WEB"][i]}</b>
                            {i === 2 ? t.friend : i === 4 ? t.draft : t.own}
                            <br />
                            {i === 0 ? "9:00–10:30" : "11:00–12:30"}
                          </div>
                        )}
                        {i === 0 && (
                          <div
                            className={`${s.miniEvent} ${s.miniOutline}`}
                            style={{ top: 166 }}
                          >
                            <b>WEB</b>
                            {t.sharedLesson}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
              <p className={s.previewFoot}>{t.preview}</p>
            </div>
          </main>
          <section className={s.features}>
            {[1, 2, 3].map((n, i) => (
              <article key={n} className={s.feature}>
                <div className={s.featureNumber}>0{n} /</div>
                <h2>{[t.feature1, t.feature2, t.feature3][i]}</h2>
                <p>{[t.feature1body, t.feature2body, t.feature3body][i]}</p>
              </article>
            ))}
          </section>
        </>
      ) : (
        <main className={s.main}>
          <div className={s.titleRow}>
            <div>
              <div className={s.eyebrow} style={{ marginBottom: 10 }}>
                {view === "timetable" ? t.tagline : "KOSwFriends"}
              </div>
              <h1>
                {view === "timetable"
                  ? t.timetable
                  : view === "friends"
                    ? t.friendsTitle
                    : view === "planner"
                      ? t.plannerTitle
                      : t.account}
              </h1>
              {view === "friends" || view === "planner" ? (
                <p className={s.subtitle}>
                  {view === "friends" ? t.friendsIntro : t.plannerIntro}
                </p>
              ) : null}
            </div>
            {(view === "timetable" || view === "planner") && (
              <div className={s.toolbar}>
                <label className={s.semesterLabel}>
                  {t.semester}
                  <select
                    value={me.semester}
                    onChange={async (e) => {
                      const semester = e.target.value;
                      setBusy(true);
                      try {
                        await mutate("/api/me", { semester }, "PATCH");
                        setMe((m) => (m ? { ...m, semester } : m));
                        setCalendars([]);
                        setChoices([]);
                        setShared([]);
                      } catch {
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {[...new Set([...semesterOptions(), me.semester])]
                      .sort()
                      .map((sem) => (
                        <option key={sem}>{sem}</option>
                      ))}
                  </select>
                </label>
                <button
                  className={`${s.button} ${s.secondary} ${s.small}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await mutate("/api/sync", {});
                    } catch {
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? t.syncing : `↻ ${t.refresh}`}
                </button>
              </div>
            )}
          </div>
          {error && (
            <div role="alert" className={`${s.banner} ${s.error}`}>
              {errorMessage}
              <button
                className={s.quiet}
                style={{ marginLeft: 14 }}
                onClick={() => setError("")}
                aria-label={t.close}
              >
                ×
              </button>
            </div>
          )}
          {me.reconnect && (
            <div className={`${s.banner} ${s.warning}`}>
              {t.reconnect} <a href={signIn}>{t.reconnectButton}</a>
            </div>
          )}
          {own?.error && view === "timetable" && (
            <div className={`${s.banner} ${s.warning}`}>
              {t.stale} {t.errors[own.error as keyof typeof t.errors] || ""}
            </div>
          )}
          {own?.lastSuccess &&
            !own.semester.verified &&
            view === "timetable" && (
              <div className={`${s.banner} ${s.warning}`}>{t.estimated}</div>
            )}
          {revoked && view === "timetable" && (
            <div className={s.banner}>{t.revoked}</div>
          )}
          {inviteFrom && (
            <section className={s.panel} style={{ marginBottom: 25 }}>
              <h2>
                {t.inviteFrom} {inviteFrom}
              </h2>
              <p className={s.muted}>{t.inviteHint}</p>
              <Sharing value={giving} change={setGiving} t={t} />
              <button
                className={s.button}
                onClick={() =>
                  mutate("/api/invites", {
                    action: "join",
                    token: inviteToken,
                    giving,
                  })
                    .then(() => {
                      setInviteToken("");
                      setInviteFrom("");
                      history.replaceState(null, "", "/");
                      setView("friends");
                    })
                    .catch(() => {})
                }
              >
                {t.joinInvite}
              </button>
            </section>
          )}
          {view === "timetable" &&
            (!calendars.length && !error ? (
              <div className={s.loading}>{t.loading}</div>
            ) : (
              <CalendarView
                key={me.semester}
                me={me}
                calendars={calendars}
                friends={friends}
                selected={selected}
                setSelected={(ids) => {
                  setSelected(ids);
                  setRevoked(false);
                }}
                choices={choices}
                locale={locale}
                t={t}
                onFriends={() => setView("friends")}
              />
            ))}
          {view === "friends" && (
            <FriendsView
              friends={friends}
              blocked={blocked}
              invites={invites}
              mutate={mutate}
              t={t}
              locale={locale}
            />
          )}
          {view === "planner" && (
            <PlannerView
              key={me.semester}
              me={me}
              choices={choices}
              shared={shared}
              calendars={calendars}
              read={read}
              mutate={mutate}
              locale={locale}
              t={t}
            />
          )}
          {view === "account" && (
            <section className={`${s.panel} ${s.accountSection}`}>
              <h2>{me.username}</h2>
              <p className={s.muted}>{t.privacy}</p>
              <button
                className={`${s.button} ${s.secondary}`}
                onClick={async () => {
                  try {
                    await request("/auth/logout", {
                      method: "POST",
                      headers: { "X-CSRF-Token": me.csrf },
                    });
                    location.assign("/");
                  } catch {
                    setError("unavailable");
                  }
                }}
              >
                {t.signOut}
              </button>
              <p className={s.hint}>{t.deletionBackup}</p>
              <button
                className={`${s.button} ${s.danger}`}
                onClick={() => deleteDialog.current?.showModal()}
              >
                {t.deleteAccount}
              </button>
            </section>
          )}
          <dialog ref={deleteDialog}>
            <h2>{t.deleteAccount}</h2>
            <p style={{ margin: "20px 0" }}>{t.deletePrompt}</p>
            <div className={s.actions}>
              <button
                className={`${s.button} ${s.danger}`}
                onClick={() =>
                  mutate("/api/me", { confirm: "DELETE" }, "DELETE")
                    .then(() => location.assign("/"))
                    .catch(() => {})
                }
              >
                {t.deleteConfirm}
              </button>
              <button
                className={`${s.button} ${s.secondary}`}
                onClick={() => deleteDialog.current?.close()}
              >
                {t.cancel}
              </button>
            </div>
          </dialog>
        </main>
      )}
      <footer className={s.footer}>
        <span>KOSwFriends / {t.tagline}</span>
        <span>{t.independent}</span>
      </footer>
      {toast && (
        <div role="status" className={s.toast}>
          {toast}
        </div>
      )}
    </div>
  );
}
