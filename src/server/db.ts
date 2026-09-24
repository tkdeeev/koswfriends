import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
let singleton: ReturnType<typeof create> | undefined;
function create() {
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  const client = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return { client, db: drizzle(client, { schema }) };
}
export function database() {
  return (singleton ??= create()).db;
}
export async function closeDatabase() {
  if (singleton) await singleton.client.end();
  singleton = undefined;
}
export type DB = ReturnType<typeof database>;
export type TX = Parameters<Parameters<DB["transaction"]>[0]>[0];
