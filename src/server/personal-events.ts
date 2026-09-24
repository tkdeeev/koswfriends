import { sql, type SQLWrapper } from "drizzle-orm";
import type { PersonalEvent } from "../lib/types";
/** Used inside the calendar's authorized SELECT, never fetched by arbitrary owner IDs. */
export function personalEventRows(
  owner: string | SQLWrapper,
  semester: string,
) {
  return sql<
    PersonalEvent[]
  >`coalesce((select jsonb_agg(p.details || jsonb_build_object('id', p.id, 'semester', p.semester))
    from personal_events p where p.owner = ${owner} and p.semester = ${semester}), '[]'::jsonb)`;
}
