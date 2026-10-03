"use client";
import { useEffect, useState } from "react";
import type { Me } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { externalCopy } from "@/lib/external-copy";
import s from "./Workspace.module.css";
type Feed = {
  id: string;
  name: string;
  lastSuccess: string | null;
  error: string | null;
};
export default function CalendarFeeds({
  me,
  locale,
  read,
  mutate,
}: {
  me: Me;
  locale: Locale;
  read: (path: string) => Promise<{ feeds: Feed[] }>;
  mutate: (path: string, data: unknown, method?: string) => Promise<unknown>;
}) {
  const c = externalCopy[locale];
  const [feeds, setFeeds] = useState<Feed[]>([]),
    [name, setName] = useState(""),
    [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      read("/api/feeds")
        .then((data) => {
          if (active) {
            setFeeds(data.feeds);
            setLoaded(true);
          }
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [me.id, me.semester, read]);
  return (
    <section className={s.feedSection} aria-labelledby="feeds-heading">
      <h3 id="feeds-heading">{c.feeds}</h3>
      <p className={s.muted}>{c.feedHint}</p>
      <p className={s.hint}>{c.limits}</p>
      {loaded && !feeds.length && <p className={s.hint}>{c.empty}</p>}
      {feeds.map((feed) => (
        <div key={feed.id} className={s.feedRow}>
          <div>
            <strong>{feed.name}</strong>
            <p className={s.hint}>
              {feed.lastSuccess
                ? `${c.synced}: ${new Date(feed.lastSuccess).toLocaleString(locale)}`
                : c.pending}
            </p>
            {feed.error && (
              <p className={s.warning}>
                {c.errors[feed.error as keyof typeof c.errors] ||
                  c.errors.ics_unavailable}
              </p>
            )}
          </div>
          <button
            className={`${s.button} ${s.secondary}`}
            disabled={busy}
            aria-label={`${c.remove}: ${feed.name}`}
            onClick={async () => {
              if (!confirm(c.removeConfirm)) return;
              setBusy(true);
              try {
                await mutate("/api/feeds", { id: feed.id }, "DELETE");
                setFeeds((old) => old.filter((f) => f.id !== feed.id));
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            {c.remove}
          </button>
        </div>
      ))}
      {feeds.length < 5 && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await mutate("/api/feeds", { name, url });
              setName("");
              setUrl("");
              setFeeds((await read("/api/feeds")).feeds);
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className={s.feedFields}>
            <label>
              {c.name}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <label>
              {c.url}
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                maxLength={2048}
                disabled={busy}
                type="url"
                placeholder="https://…/calendar.ics"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <button className={s.button} disabled={busy || !loaded}>
            {busy ? c.importing : c.add}
          </button>
        </form>
      )}
    </section>
  );
}
