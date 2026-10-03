"use client";
import { useContext, useState } from "react";
import { avatarColor, initials, displayName } from "@/lib/appearance";
import type { Person } from "@/lib/types";
import s from "./Workspace.module.css";
import { PeopleContext } from "./PeopleContext";
import { dailyCopy } from "@/lib/daily-copy";
import { externalCopy } from "@/lib/external-copy";
export default function Avatar({
  person,
  small = false,
}: {
  person: Pick<Person, "username"> & Partial<Person>;
  small?: boolean;
}) {
  const { people, locale } = useContext(PeopleContext);
  const availability = people.find(
    (p) => p.person.id === person.id,
  )?.availability;
  const state = availability?.state;
  const label =
    state === "free"
      ? dailyCopy[locale].free
      : state === "soon"
        ? dailyCopy[locale].soon
        : state === "busy"
          ? dailyCopy[locale].now
          : null;
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
      {label && (
        <span
          className={s.availabilityDot}
          data-availability={state}
          role="img"
          aria-label={label}
          title={label}
        />
      )}
      {person.accountType === "external" && (
        <span
          className={s.avatarExternal}
          role="img"
          aria-label={externalCopy[locale].external}
          title={externalCopy[locale].external}
        >
          EXT
        </span>
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
