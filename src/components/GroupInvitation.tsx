"use client";
import { useEffect, useState } from "react";
import type { Grant, Me } from "@/lib/types";
import type { Text } from "@/lib/i18n";
import { Sharing, type Mutate } from "./FriendsView";
import s from "./Workspace.module.css";
type Preview = { id: string; name: string; owner: string; joined: boolean };
export default function GroupInvitation({
  token,
  me,
  request,
  mutate,
  t,
  dismiss,
  joined,
  onError,
}: {
  token: string;
  me: Me;
  request: (path: string, init?: RequestInit) => Promise<{ group: Preview }>;
  mutate: Mutate;
  t: Text;
  dismiss: () => void;
  joined: () => void;
  onError: (error: string) => void;
}) {
  const [group, setGroup] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [giving, setGiving] = useState<Grant>({ calendar: true, plans: false });
  useEffect(() => {
    let active = true;
    request("/api/group-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf },
      body: JSON.stringify({ action: "preview", token }),
    })
      .then((data) => {
        if (active) setGroup(data.group);
      })
      .catch((e) => {
        if (active) {
          setFailed(true);
          onError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token, me.id, me.csrf, request, onError]);
  return (
    <section
      className={s.panel}
      style={{ marginBottom: 25 }}
      aria-label={t.groupInvitation}
    >
      <h2>
        {t.groupInvitation}
        {group ? ` · ${group.name}` : ""}
      </h2>
      {!group && !failed && <p>{t.loading}</p>}
      {group && (
        <>
          <p className={s.muted}>
            {t.groupOwner}: {group.owner}
          </p>
          {!group.joined && (
            <>
              <p className={s.hint}>{t.groupJoinHint}</p>
              <Sharing
                value={giving}
                change={setGiving}
                t={t}
                legend={t.groupShareBefore}
              />
            </>
          )}
        </>
      )}
      <div className={s.actions}>
        {group && (
          <button
            className={s.button}
            disabled={busy}
            onClick={async () => {
              if (group.joined) {
                joined();
                return;
              }
              setBusy(true);
              try {
                await mutate("/api/group-invites", {
                  action: "join",
                  token,
                  giving,
                });
                joined();
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            {group.joined ? t.openGroup : t.joinGroup}
          </button>
        )}
        <button className={s.quiet} disabled={busy} onClick={dismiss}>
          {t.cancel}
        </button>
      </div>
    </section>
  );
}
