import { sql, type SQLWrapper } from "drizzle-orm";
import type { TX } from "./db";
import { overrides } from "./schema";
import type { Grant } from "../lib/types";
type Id = string | SQLWrapper;
export function isBlocked(owner: Id, viewer: Id) {
  return sql<boolean>`exists (select 1 from blocks b where
    (b.owner = ${owner} and b.target = ${viewer}) or
    (b.owner = ${viewer} and b.target = ${owner}))`;
}
export function related(owner: Id, viewer: Id) {
  return sql<boolean>`(exists (select 1 from friendships f where f.status = 'accepted'
    and ((f.a = ${owner} and f.b = ${viewer}) or (f.b = ${owner} and f.a = ${viewer})))
    or exists (select 1 from group_members gm join group_members vm on vm.group_id = gm.group_id
      where gm.user_id = ${owner} and vm.user_id = ${viewer}
      and gm.status = 'accepted' and vm.status = 'accepted'))`;
}
/** Evaluate in the same statement that reads private data. Blocks always win;
 * overrides require a current accepted relationship and survive group changes. */
export function canRead(owner: Id, viewer: Id, kind: keyof Grant) {
  const field = sql.identifier(kind);
  return sql<boolean>`(${owner} <> ${viewer} and not ${isBlocked(owner, viewer)}
    and ${related(owner, viewer)} and coalesce(
      (select o.${field} from sharing_overrides o where o.owner = ${owner} and o.viewer = ${viewer}),
      (exists (select 1 from grants g join friendships f on
        ((f.a = g.owner and f.b = g.viewer) or (f.b = g.owner and f.a = g.viewer))
        where g.owner = ${owner} and g.viewer = ${viewer} and g.${field} and f.status = 'accepted')
       or exists (select 1 from group_members gm join group_members vm on vm.group_id = gm.group_id
        where gm.user_id = ${owner} and vm.user_id = ${viewer} and gm.${field}
        and gm.status = 'accepted' and vm.status = 'accepted'))))`;
}
export async function saveOverride(
  tx: TX,
  owner: string,
  viewer: string,
  giving: Grant,
) {
  await tx
    .insert(overrides)
    .values({ owner, viewer, ...giving })
    .onConflictDoUpdate({
      target: [overrides.owner, overrides.viewer],
      set: giving,
    });
}
