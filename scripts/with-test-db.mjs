import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "koswfriends-tests-"));
const port = 55438;
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({
  databaseDir: join(directory, "data"),
  user: "test",
  password,
  port,
  persistent: false,
  onLog() {},
  onError() {},
});
let child;
let exitCode = 1;
async function run(command, args, env) {
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("koswfriends_test");
  const env = {
    ...process.env,
    DATABASE_URL: `postgres://test:${password}@127.0.0.1:${port}/koswfriends_test`,
    APP_URL: "http://localhost:3100",
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    SCHOOL_OAUTH_CLIENT_ID: "synthetic-client",
    SCHOOL_OAUTH_CLIENT_SECRET: "synthetic-secret",
    NODE_ENV: "test",
    KWF_TEST_DATABASE: "yes",
  };
  const migration = await run(
    "node_modules/.bin/tsx",
    ["src/server/migrate.ts"],
    env,
  );
  if (migration !== 0) throw new Error("test_migration_failed");
  exitCode = await run(
    `node_modules/.bin/${process.argv[2]}`,
    process.argv.slice(3),
    env,
  );
} finally {
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
}
// embedded-postgres installs an async beforeExit hook; an explicit exit preserves
// the child status instead of letting that hook replace a failing code with 0.
process.exit(exitCode);
