"use client";
import { useState } from "react";
import type { Grant, Me, SharingGroup } from "@/lib/types";
import type { Locale, Text } from "@/lib/i18n";
import { Sharing, type Mutate } from "./FriendsView";
import Avatar from "./Avatar";
import GroupInviteLink, { type Read } from "./GroupInviteLink";
import s from "./Workspace.module.css";
function MemberRow({
  member,
  group,
  me,
  mutate,
  t,
}: {
  member: SharingGroup["members"][number];
  group: SharingGroup;
  me: Me;
  mutate: Mutate;
  t: Text;
}) {
  const [giving, setGiving] = useState(member.giving);
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    try {
      if (action === "block")
        await mutate("/api/friends", { id: member.id, action }, "PATCH");
      else
        await mutate(
          "/api/groups",
          { id: group.id, target: member.id, action, giving },
          "PATCH",
        );
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={s.groupMember}>
      <div className={s.rowHead}>
        <div className={s.person}>
          <Avatar person={member} />
          <div>
            <strong>{member.username}</strong>
            <p className={s.muted}>
              {member.name !== member.username ? member.name : ""}
            </p>
          </div>
        </div>
        <span className={s.badge}>
          {member.status === "pending"
            ? t.outgoing
            : member.blocked
              ? t.blocked
              : member.overridden
                ? t.customSharing
                : t.groupDefaults}
        </span>
      </div>
      {member.status === "accepted" && !member.blocked && (
        <>
          <p className={s.hint}>
            {t.receiving}:{" "}
            {[
              member.receiving.calendar && t.timetable,
              member.receiving.plans && t.planner,
            ]
              .filter(Boolean)
              .join(" · ") || t.nothing}
          </p>
          <Sharing value={giving} change={setGiving} t={t} />
          <div className={s.actions}>
            <button
              className={`${s.button} ${s.small}`}
              disabled={busy}
              onClick={() => act("override")}
            >
              {t.saveSharing}
            </button>
            {member.overridden && (
              <button
                className={`${s.button} ${s.secondary} ${s.small}`}
                disabled={busy}
                onClick={() => act("reset")}
              >
                {t.useDefaults}
              </button>
            )}
            <button
              className={s.quiet}
              disabled={busy}
              onClick={() => act("block")}
            >
              {t.block}
            </button>
          </div>
        </>
      )}
      {group.owner === me.id && (
        <button
          className={`${s.quiet} ${s.small}`}
          disabled={busy}
          onClick={() => act("remove")}
        >
          {t.removeMember}
        </button>
      )}
    </article>
  );
}
function GroupCard({
  group,
  me,
  mutate,
  read,
  locale,
  t,
}: {
  group: SharingGroup;
  me: Me;
  mutate: Mutate;
  read: Read;
  locale: Locale;
  t: Text;
}) {
  const [giving, setGiving] = useState<Grant>(
    group.status === "pending"
      ? { calendar: true, plans: false }
      : group.giving,
  );
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    try {
      await mutate(
        "/api/groups",
        {
          id: group.id,
          action,
          giving,
          ...(action === "invite" ? { username } : {}),
        },
        "PATCH",
      );
      setUsername("");
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const admin = group.owner === me.id;
  return (
    <section className={s.panel} aria-label={group.name}>
      <div className={s.rowHead}>
        <h2>{group.name}</h2>
        <span className={s.badge}>
          {group.status === "pending"
            ? t.groupInvitation
            : admin
              ? t.groupOwner
              : `${group.members.length} ${t.members}`}
        </span>
      </div>
      <p className={s.hint}>{t.groupSharingHint}</p>
      <Sharing
        value={giving}
        change={setGiving}
        t={t}
        legend={t.groupShareBefore}
      />
      <div className={s.actions}>
        <button
          className={`${s.button} ${s.small}`}
          disabled={busy}
          onClick={() => act(group.status === "pending" ? "accept" : "sharing")}
        >
          {group.status === "pending" ? t.accept : t.saveSharing}
        </button>
        {group.status === "pending" ? (
          <button
            className={`${s.button} ${s.secondary} ${s.small}`}
            disabled={busy}
            onClick={() => act("decline")}
          >
            {t.decline}
          </button>
        ) : (
          <button className={s.quiet} onClick={() => setConfirm(true)}>
            {admin ? t.deleteGroup : t.leaveGroup}
          </button>
        )}
      </div>
      {confirm && (
        <div className={s.banner}>
          <p>{admin ? t.deleteGroupConfirm : t.leaveGroupConfirm}</p>
          <div className={s.actions}>
            <button
              className={`${s.button} ${s.danger} ${s.small}`}
              disabled={busy}
              onClick={() => act(admin ? "delete" : "leave")}
            >
              {admin ? t.deleteGroup : t.leaveGroup}
            </button>
            <button className={s.quiet} onClick={() => setConfirm(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {group.status === "accepted" && (
        <>
          {admin && (
            <GroupInviteLink
              groupId={group.id}
              rosterKey={group.members
                .map((m) => `${m.id}:${m.status}`)
                .sort()
                .join(",")}
              read={read}
              mutate={mutate}
              locale={locale}
              t={t}
            />
          )}
          {admin && (
            <form
              className={s.inlineForm}
              onSubmit={(e) => {
                e.preventDefault();
                void act("invite");
              }}
            >
              <label className={s.field}>
                {t.username}
                <input
                  required
                  maxLength={80}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className={`${s.button} ${s.secondary} ${s.small}`}
                disabled={busy}
              >
                {t.inviteMember}
              </button>
            </form>
          )}
          <p className={s.hint}>{t.overrideHint}</p>
          {group.members
            .filter((m) => m.id !== me.id)
            .map((member) => (
              <MemberRow
                key={`${member.id}:${member.status}:${member.blocked}:${member.overridden}:${JSON.stringify(member.giving)}`}
                member={member}
                group={group}
                me={me}
                mutate={mutate}
                t={t}
              />
            ))}
          {group.members.length === 1 && (
            <p className={s.hint}>{t.emptyGroup}</p>
          )}
        </>
      )}
    </section>
  );
}
export default function GroupsView({
  groups,
  me,
  mutate,
  read,
  locale,
  t,
}: {
  groups: SharingGroup[];
  me: Me;
  mutate: Mutate;
  read: Read;
  locale: Locale;
  t: Text;
}) {
  const [name, setName] = useState("");
  const [giving, setGiving] = useState<Grant>({ calendar: true, plans: false });
  const [busy, setBusy] = useState(false);
  return (
    <div className={s.groupsLayout}>
      <section className={s.panel}>
        <h2>{t.createGroup}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await mutate("/api/groups", { name, giving });
              setName("");
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={s.field}>
            {t.groupName}
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Sharing
            value={giving}
            change={setGiving}
            t={t}
            legend={t.groupShareBefore}
          />
          <p className={s.hint}>{t.groupSharingHint}</p>
          <button className={s.button} disabled={busy}>
            {t.createGroup}
          </button>
        </form>
      </section>
      <div className={s.stack}>
        {groups.map((group) => (
          <GroupCard
            key={`${group.id}:${group.status}:${JSON.stringify(group.giving)}`}
            group={group}
            me={me}
            read={read}
            locale={locale}
            mutate={mutate}
            t={t}
          />
        ))}
        {!groups.length && (
          <div className={s.empty}>
            <h3>{t.noSharingGroups}</h3>
          </div>
        )}
      </div>
    </div>
  );
}
