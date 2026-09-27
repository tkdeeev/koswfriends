"use client";
import { useState } from "react";
import { avatarColor, initials, displayName } from "@/lib/appearance";
import type { Person } from "@/lib/types";
import s from "./Workspace.module.css";
export default function Avatar({
  person,
  small = false,
}: {
  person: Pick<Person, "username"> & Partial<Person>;
  small?: boolean;
}) {
  return (
    <span
      className={`${s.profileAvatar} ${small ? s.smallAvatar : ""}`}
      style={{ backgroundColor: avatarColor(person.username) }}
      title={
        person.name && person.name !== person.username
          ? `${person.name} (${person.username})`
          : person.username
      }
      aria-label={displayName(person)}
    >
      {person.id && person.avatarVersion ? (
        <Picture key={`${person.id}:${person.avatarVersion}`} person={person} />
      ) : (
        initials(person.username, person.name)
      )}
    </span>
  );
}
function Picture({
  person,
}: {
  person: Pick<Person, "username"> & Partial<Person>;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    initials(person.username, person.name)
  ) : (
    <img
      src={`/api/picture?id=${person.id}&v=${person.avatarVersion}`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
export function AvatarStack({
  people,
  limit = 3,
}: {
  people: Person[];
  limit?: number;
}) {
  if (!people.length) return null;
  return (
    <span
      className={s.avatarStack}
      aria-label={people.map(displayName).join(", ")}
    >
      {people.slice(0, limit).map((p) => (
        <Avatar person={p} small key={p.id} />
      ))}
      {people.length > limit && (
        <span className={`${s.profileAvatar} ${s.smallAvatar} ${s.avatarMore}`}>
          +{people.length - limit}
        </span>
      )}
    </span>
  );
}
