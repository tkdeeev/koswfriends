"use client";
import { useEffect, useState } from "react";
import type { Locale, Text } from "@/lib/i18n";
import type { Mutate } from "./FriendsView";
import s from "./Workspace.module.css";
export type Read = (path: string) => Promise<Record<string, unknown>>;
type Link = { url: string; expiresAt: string };
export default function GroupInviteLink({
  groupId,
  rosterKey,
  read,
  mutate,
  locale,
  t,
}: {
  groupId: string;
  rosterKey: string;
  read: Read;
  mutate: Mutate;
  locale: Locale;
  t: Text;
}) {
  const [link, setLink] = useState<Link | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"" | "copied" | "manual">("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLink(null);
    read(`/api/group-invites?group=${groupId}`)
      .then((data) => {
        if (active) setLink(data.link as Link | null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupId, rosterKey, read]);
  const change = async (revoke: boolean) => {
    setBusy(true);
    setCopyStatus("");
    try {
      const data = await mutate(
        "/api/group-invites",
        { groupId, ...(revoke ? {} : { action: "create" }) },
        revoke ? "DELETE" : "POST",
      );
      setLink(revoke ? null : (data.link as Link));
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.groupInviteLink}>
      <h3>{t.groupLink}</h3>
      <p className={s.hint}>{t.groupLinkHint}</p>
      {link && (
        <>
          <a className={s.inviteUrl} href={link.url}>
            {link.url}
          </a>
          <p className={s.hint}>
            {t.expires}:{" "}
            {new Date(link.expiresAt).toLocaleString(locale, {
              timeZone: "Europe/Prague",
            })}
          </p>
        </>
      )}
      <div className={s.actions}>
        <button
          className={`${s.button} ${s.secondary} ${s.small}`}
          disabled={busy || loading}
          onClick={() => change(false)}
        >
          {link ? t.replaceGroupLink : t.createGroupLink}
        </button>
        {link && (
          <>
            <button
              className={s.quiet}
              disabled={busy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  setCopyStatus("copied");
                } catch {
                  setCopyStatus("manual");
                }
              }}
            >
              {t.copyGroupLink}
            </button>
            <button
              className={s.quiet}
              disabled={busy}
              onClick={() => change(true)}
            >
              {t.revoke}
            </button>
          </>
        )}
      </div>
      {copyStatus && (
        <p className={s.hint} role="status">
          {copyStatus === "copied" ? t.copiedGroupLink : t.copyGroupLinkHint}
        </p>
      )}
    </div>
  );
}
