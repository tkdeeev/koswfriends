"use client";
import { useEffect, useState } from "react";
import type { Friend, Grant, Person } from "@/lib/types";
import type { Locale, Text } from "@/lib/i18n";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { displayName } from "@/lib/appearance";
import s from "./Workspace.module.css";
export type Mutate = (
  path: string,
  data: unknown,
  method?: string,
) => Promise<Record<string, unknown>>;
export function Sharing({
  value,
  change,
  t,
  legend,
}: {
  legend?: string;
  value: Grant;
  change: (g: Grant) => void;
  t: Text;
}) {
  return (
    <fieldset className={s.sharing}>
      <legend>{legend || t.shareBefore}</legend>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={value.calendar}
          onChange={(e) => change({ ...value, calendar: e.target.checked })}
        />
        {t.shareCalendar}
      </label>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={value.plans}
          onChange={(e) => change({ ...value, plans: e.target.checked })}
        />
        {t.sharePlans}
      </label>
    </fieldset>
  );
}
function FriendRow({
  friend,
  mutate,
  t,
}: {
  friend: Friend;
  mutate: Mutate;
  t: Text;
}) {
  const [giving, setGiving] = useState(
    friend.status === "accepted"
      ? friend.giving
      : { calendar: true, plans: false },
  );
  useEffect(
    () =>
      setGiving(
        friend.status === "accepted"
          ? friend.giving
          : { calendar: true, plans: false },
      ),
    [friend.status, friend.giving.calendar, friend.giving.plans],
  );
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    try {
      await mutate("/api/friends", { id: friend.id, action, giving }, "PATCH");
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={s.connectionRow}>
      <details>
        <summary
          className={s.connectionSummary}
          aria-label={displayName(friend)}
        >
          <div className={s.person}>
            <Avatar person={friend} />
            <strong>{displayName(friend)}</strong>
          </div>
          {friend.status === "pending" && (
            <span className={s.badge}>
              {friend.incoming ? t.incoming : t.outgoing}
            </span>
          )}
          <Icon name="chevron" className={s.rowChevron} />
        </summary>
        <div className={s.connectionDetails}>
          <p className={s.hint}>@{friend.username}</p>
          {friend.status === "accepted" ? (
            <>
              <p className={s.hint}>
                {t.receiving}:{" "}
                {[
                  friend.receiving.calendar && t.timetable,
                  friend.receiving.plans && t.planner,
                ]
                  .filter(Boolean)
                  .join(" · ") || t.nothing}
              </p>
              <Sharing value={giving} change={setGiving} t={t} />
              <div className={s.actions}>
                <button
                  disabled={busy}
                  className={`${s.button} ${s.small}`}
                  onClick={() => act("sharing")}
                >
                  {t.saveSharing}
                </button>
                <button
                  disabled={busy}
                  className={`${s.button} ${s.secondary} ${s.small}`}
                  onClick={() => act("remove")}
                >
                  {t.remove}
                </button>
                <button
                  disabled={busy}
                  className={`${s.quiet} ${s.small}`}
                  onClick={() => act("block")}
                >
                  {t.block}
                </button>
              </div>
            </>
          ) : friend.incoming ? (
            <>
              <Sharing value={giving} change={setGiving} t={t} />
              <div className={s.actions}>
                <button
                  disabled={busy}
                  className={`${s.button} ${s.small}`}
                  onClick={() => act("accept")}
                >
                  {t.accept}
                </button>
                <button
                  disabled={busy}
                  className={`${s.button} ${s.secondary} ${s.small}`}
                  onClick={() => act("decline")}
                >
                  {t.decline}
                </button>
                <button
                  disabled={busy}
                  className={`${s.quiet} ${s.small}`}
                  onClick={() => act("block")}
                >
                  {t.block}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={s.hint}>
                {t.sharing}:{" "}
                {[
                  friend.giving.calendar && t.timetable,
                  friend.giving.plans && t.planner,
                ]
                  .filter(Boolean)
                  .join(" · ") || t.nothing}
              </p>
              <button
                disabled={busy}
                className={s.quiet}
                onClick={() => act("remove")}
              >
                {t.cancelRequest}
              </button>
            </>
          )}
        </div>
      </details>
    </article>
  );
}
export type Invite = { id: string; expiresAt: string; revoked: boolean };
export function FriendsAdd({
  invites,
  mutate,
  t,
  locale,
  added,
}: {
  invites: Invite[];
  mutate: Mutate;
  t: Text;
  locale: Locale;
  added: () => void;
}) {
  const [username, setUsername] = useState("");
  const [giving, setGiving] = useState<Grant>({ calendar: true, plans: false });
  const [inviteGiving, setInviteGiving] = useState<Grant>({
    calendar: true,
    plans: false,
  });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className={s.addForm}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await mutate("/api/friends", { username, giving });
            setUsername("");
            added();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className={s.field}>
          {t.username}
          <input
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={80}
            placeholder="username"
          />
        </label>

        <Sharing value={giving} change={setGiving} t={t} />
        <button disabled={busy} className={s.button}>
          {t.sendRequest} <span aria-hidden>↗</span>
        </button>
      </form>
      <details className={s.inviteOptions}>
        <summary>{t.invite}</summary>
        <p className={s.muted}>{t.inviteHint}</p>
        <Sharing value={inviteGiving} change={setInviteGiving} t={t} />
        <button
          className={s.button}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await mutate("/api/invites", {
                action: "create",
                giving: inviteGiving,
              });
              setUrl(String(data.url));
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.createInvite}
        </button>
        {url && (
          <>
            <a href={url} className={s.inviteUrl}>
              {url}
            </a>
            <button
              className={`${s.button} ${s.secondary} ${s.small}`}
              onClick={() => navigator.clipboard.writeText(url).catch(() => {})}
            >
              {t.copy}
            </button>
          </>
        )}
        <h3 style={{ marginTop: 26 }}>{t.activeInvites}</h3>
        <ul className={s.list}>
          {invites
            .filter((i) => !i.revoked && Date.parse(i.expiresAt) > Date.now())
            .map((i) => (
              <li key={i.id}>
                <div className={s.rowHead}>
                  <span className={s.hint}>
                    {t.expires}:{" "}
                    {new Date(i.expiresAt).toLocaleDateString(locale, {
                      timeZone: "Europe/Prague",
                    })}
                  </span>
                  <button
                    className={s.quiet}
                    onClick={() =>
                      mutate("/api/invites", { id: i.id }, "DELETE")
                        .then(() => setUrl(""))
                        .catch(() => {})
                    }
                  >
                    {t.revoke}
                  </button>
                </div>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}
export default function FriendsView({
  friends,
  blocked,
  mutate,
  t,
}: {
  friends: Friend[];
  blocked: Person[];
  mutate: Mutate;
  t: Text;
}) {
  return (
    <>
      {friends.length ? (
        friends.map((friend) => (
          <FriendRow key={friend.id} friend={friend} mutate={mutate} t={t} />
        ))
      ) : (
        <div className={s.empty}>
          <h3>{t.noFriends}</h3>
        </div>
      )}
      {blocked.length > 0 && (
        <details className={s.inviteOptions}>
          <summary>
            {t.blocked} · {blocked.length}
          </summary>
          {blocked.map((person) => (
            <div key={person.id} className={s.rowHead}>
              <span className={s.person}>
                <Avatar person={person} />
                {displayName(person)}
              </span>
              <button
                className={s.quiet}
                onClick={() =>
                  mutate(
                    "/api/friends",
                    { id: person.id, action: "unblock" },
                    "PATCH",
                  ).catch(() => {})
                }
              >
                {t.unblock}
              </button>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
