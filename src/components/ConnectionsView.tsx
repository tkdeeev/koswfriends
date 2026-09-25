"use client";
import { useEffect, useRef, useState } from "react";
import type { Friend, Me, Person, SharingGroup } from "@/lib/types";
import type { Locale, Text } from "@/lib/i18n";
import FriendsView, {
  FriendsAdd,
  type Invite,
  type Mutate,
} from "./FriendsView";
import GroupsView, { GroupsAdd } from "./GroupsView";
import type { Read } from "./GroupInviteLink";
import s from "./Workspace.module.css";

export type ConnectionTab = "friends" | "groups";

function Switch({
  value,
  change,
  t,
  label,
}: {
  value: ConnectionTab;
  change: (tab: ConnectionTab) => void;
  t: Text;
  label: string;
}) {
  return (
    <div className={s.connectionSwitch} role="group" aria-label={label}>
      {(["friends", "groups"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => change(tab)}
        >
          {t[tab]}
        </button>
      ))}
    </div>
  );
}

export default function ConnectionsView({
  friends,
  blocked,
  groups,
  invites,
  me,
  mutate,
  read,
  locale,
  t,
  tab,
  setTab,
  addOpen,
  closeAdd,
  error,
}: {
  friends: Friend[];
  blocked: Person[];
  groups: SharingGroup[];
  invites: Invite[];
  me: Me;
  mutate: Mutate;
  read: Read;
  locale: Locale;
  t: Text;
  tab: ConnectionTab;
  setTab: (tab: ConnectionTab) => void;
  addOpen: boolean;
  closeAdd: () => void;
  error?: string;
}) {
  const [addTab, setAddTab] = useState<ConnectionTab>(tab);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (addOpen) {
      setAddTab(tab);
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [addOpen]);
  const added = () => {
    setTab(addTab);
    closeAdd();
  };
  return (
    <>
      <div className={s.mobileConnectionSwitch}>
        <Switch value={tab} change={setTab} t={t} label={t.connections} />
      </div>
      <div className={s.connectionColumns}>
        <section
          className={`${s.connectionColumn} ${tab !== "friends" ? s.mobileConnectionHidden : ""}`}
          aria-label={t.friends}
        >
          <h2>
            {t.friends}
            <span>{friends.length}</span>
          </h2>
          <FriendsView
            friends={friends}
            blocked={blocked}
            mutate={mutate}
            t={t}
          />
        </section>
        <section
          className={`${s.connectionColumn} ${tab !== "groups" ? s.mobileConnectionHidden : ""}`}
          aria-label={t.groups}
        >
          <h2>
            {t.groups}
            <span>{groups.length}</span>
          </h2>
          <GroupsView
            groups={groups}
            me={me}
            mutate={mutate}
            read={read}
            locale={locale}
            t={t}
          />
        </section>
      </div>
      <dialog
        ref={dialog}
        className={s.connectionDialog}
        aria-labelledby="add-connection-title"
        onCancel={closeAdd}
        onClose={closeAdd}
      >
        <div className={s.dialogTitle}>
          <h2 id="add-connection-title">{t.addConnection}</h2>
          <button
            type="button"
            className={s.iconButton}
            onClick={closeAdd}
            aria-label={t.close}
          >
            ×
          </button>
        </div>
        <Switch
          value={addTab}
          change={setAddTab}
          t={t}
          label={t.connectionType}
        />
        {error && (
          <p className={`${s.banner} ${s.error}`} role="alert">
            {error}
          </p>
        )}
        <div hidden={addTab !== "friends"}>
          <FriendsAdd
            invites={invites}
            mutate={mutate}
            t={t}
            locale={locale}
            added={added}
          />
        </div>
        <div hidden={addTab !== "groups"}>
          <GroupsAdd mutate={mutate} t={t} added={added} />
        </div>
      </dialog>
    </>
  );
}
