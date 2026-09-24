import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Lesson, Choice, Semester } from "../lib/types";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  semester: text("semester").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  activeAt: time("active_at").defaultNow().notNull(),
});
const userRef = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
export const connections = pgTable("connections", {
  userId: userRef("user_id").primaryKey(),
  access: text("access").notNull(),
  refresh: text("refresh"),
  expiresAt: time("expires_at").notNull(),
  reconnect: boolean("reconnect").default(false).notNull(),
});
export const sessions = pgTable(
  "sessions",
  {
    hash: text("hash").primaryKey(),
    userId: userRef("user_id"),
    csrf: text("csrf").notNull(),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const attempts = pgTable("oauth_attempts", {
  hash: text("hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  expiresAt: time("expires_at").notNull(),
  returnTo: text("return_to").notNull().default("/"),
});
export const friendships = pgTable(
  "friendships",
  {
    a: userRef("a"),
    b: userRef("b"),
    requester: userRef("requester"),
    status: text("status").$type<"pending" | "accepted">().notNull(),
    createdAt: time("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.a, t.b] }),
    check("ordered_pair", sql`${t.a} < ${t.b}`),
    check("friend_status", sql`${t.status} in ('pending', 'accepted')`),
  ],
);
export const grants = pgTable(
  "grants",
  {
    owner: userRef("owner"),
    viewer: userRef("viewer"),
    calendar: boolean("calendar").default(true).notNull(),
    plans: boolean("plans").default(false).notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.viewer] })],
);
export const blocks = pgTable(
  "blocks",
  { owner: userRef("owner"), target: userRef("target") },
  (t) => [primaryKey({ columns: [t.owner, t.target] })],
);
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  hash: text("hash").notNull().unique(),
  owner: userRef("owner"),
  calendar: boolean("calendar").notNull(),
  plans: boolean("plans").notNull(),
  expiresAt: time("expires_at").notNull(),
  revoked: boolean("revoked").default(false).notNull(),
});
export const snapshots = pgTable(
  "snapshots",
  {
    userId: userRef("user_id"),
    semester: text("semester").notNull(),
    events: jsonb("events").$type<Lesson[]>().notNull().default([]),
    window: jsonb("window").$type<Semester>().notNull(),
    lastAttempt: time("last_attempt"),
    lastSuccess: time("last_success"),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.semester] })],
);
export const plans = pgTable(
  "plans",
  {
    userId: userRef("user_id"),
    semester: text("semester").notNull(),
    choices: jsonb("choices").$type<Choice[]>().notNull().default([]),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.semester] })],
);
export const workerStatus = pgTable("worker_status", {
  id: text("id").primaryKey(),
  heartbeat: time("heartbeat").defaultNow().notNull(),
});
