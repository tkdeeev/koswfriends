import { database } from "@/server/db";
import { sql } from "drizzle-orm";
import { json } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const rows = await database().execute(
      sql`select heartbeat > now() - interval '2 minutes' as alive from worker_status where id = 'sync'`,
    );
    const worker = rows[0]?.alive === true;
    return json(
      {
        status: worker ? "ready" : "degraded",
        database: "ok",
        worker: worker ? "ok" : "stale",
        version: process.env.APP_VERSION || "0.3.1",
        revision: process.env.APP_REVISION || "local",
      },
      worker ? 200 : 503,
    );
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
