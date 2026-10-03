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
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Lesson, Choice, Semester, PersonalEventData } from "../lib/types";
import type { SubjectTask } from "../lib/subject-board";
import type { Localized } from "../lib/types";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  accountType: text("account_type")
    .$type<"cvut" | "external">()
    .default("cvut")
    .notNull(),
  feedAttemptAt: time("feed_attempt_at"),
  name: text("name").notNull(),
  avatarVersion: uuid("avatar_version"),
  semester: text("semester").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  activeAt: time("active_at").defaultNow().notNull(),
});
const userRef = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
export const profilePictures = pgTable("profile_pictures", {
  userId: userRef("user_id").primaryKey(),
  // Only a small, re-encoded WebP is stored; never the original upload.
  image: text("image").notNull(),
});
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
  provider: text("provider").notNull().default("cvut"),
  verifier: text("verifier"),
});
export const identities = pgTable(
  "external_identities",
  {
    provider: text("provider").$type<"google" | "discord">().notNull(),
    subject: text("subject").notNull(),
    userId: userRef("user_id"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.subject] }),
    index("external_identity_user_idx").on(t.userId),
  ],
);
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: userRef("user_id"),
    name: text("name").notNull(),
    // Subscription URLs commonly contain private calendar tokens.
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    createdAt: time("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("calendar_feed_user_url_idx").on(t.userId, t.urlHash)],
);
export const feedSnapshots = pgTable(
  "feed_snapshots",
  {
    feedId: uuid("feed_id")
      .notNull()
      .references(() => calendarFeeds.id, { onDelete: "cascade" }),
    semester: text("semester").notNull(),
    events: jsonb("events").$type<Lesson[]>().notNull().default([]),
    lastAttempt: time("last_attempt").notNull(),
    lastSuccess: time("last_success"),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.feedId, t.semester] })],
);
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

// Deliberately separate from timetable snapshots and all sharing queries.
export const subjectBoards = pgTable(
  "subject_boards",
  {
    userId: userRef("user_id"),
    semester: text("semester").notNull(),
    course: text("course").notNull(),
    title: jsonb("title").$type<Localized>().notNull(),
    notes: text("notes").notNull().default(""),
    tasks: jsonb("tasks").$type<SubjectTask[]>().notNull().default([]),
    revision: integer("revision").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.semester, t.course] })],
);

export const groups = pgTable("sharing_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  owner: userRef("owner"),
  name: text("name").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});
export const members = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    status: text("status").$type<"pending" | "accepted">().notNull(),
    calendar: boolean("calendar").default(false).notNull(),
    plans: boolean("plans").default(false).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_member_user_idx").on(t.userId),
    check("member_status", sql`${t.status} in ('pending', 'accepted')`),
  ],
);
/** A person's explicit preference takes precedence over every sharing source. */
export const overrides = pgTable(
  "sharing_overrides",
  {
    owner: userRef("owner"),
    viewer: userRef("viewer"),
    calendar: boolean("calendar").notNull(),
    plans: boolean("plans").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.viewer] })],
);

export const personalEvents = pgTable(
  "personal_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    owner: userRef("owner"),
    semester: text("semester").notNull(),
    details: jsonb("details").$type<PersonalEventData>().notNull(),
  },
  (t) => [index("personal_event_owner_semester_idx").on(t.owner, t.semester)],
);

/** One revocable link per group; encrypted so its owner can copy it again. */
export const groupInvites = pgTable("group_invites", {
  groupId: uuid("group_id")
    .primaryKey()
    .references(() => groups.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  token: text("token").notNull(),
  expiresAt: time("expires_at").notNull(),
});
