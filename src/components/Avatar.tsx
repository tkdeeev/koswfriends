import { avatarColor, initials, displayName } from "@/lib/appearance";
import type { Person } from "@/lib/types";
import s from "./Workspace.module.css";
export default function Avatar({
  person,
  small = false,
}: {
  person: Pick<Person, "username"> & { name?: string };
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
      {initials(person.username)}
    </span>
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
