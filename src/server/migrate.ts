import { migrate } from "drizzle-orm/postgres-js/migrator";
import { database, closeDatabase } from "./db";
try {
  await migrate(database(), { migrationsFolder: "./migrations" });
  console.log("Migrations complete");
} catch {
  console.error("Migration failed; deployment must stop.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
