CREATE TABLE "oauth_attempts" (
	"hash" text PRIMARY KEY NOT NULL,
	"browser_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"return_to" text DEFAULT '/' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"owner" uuid NOT NULL,
	"target" uuid NOT NULL,
	CONSTRAINT "blocks_owner_target_pk" PRIMARY KEY("owner","target")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access" text NOT NULL,
	"refresh" text,
	"expires_at" timestamp with time zone NOT NULL,
	"reconnect" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"a" uuid NOT NULL,
	"b" uuid NOT NULL,
	"requester" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_a_b_pk" PRIMARY KEY("a","b"),
	CONSTRAINT "ordered_pair" CHECK ("friendships"."a" < "friendships"."b"),
	CONSTRAINT "friend_status" CHECK ("friendships"."status" in ('pending', 'accepted'))
);
--> statement-breakpoint
CREATE TABLE "grants" (
	"owner" uuid NOT NULL,
	"viewer" uuid NOT NULL,
	"calendar" boolean DEFAULT true NOT NULL,
	"plans" boolean DEFAULT false NOT NULL,
	CONSTRAINT "grants_owner_viewer_pk" PRIMARY KEY("owner","viewer")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" text NOT NULL,
	"owner" uuid NOT NULL,
	"calendar" boolean NOT NULL,
	"plans" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "invites_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"user_id" uuid NOT NULL,
	"semester" text NOT NULL,
	"choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_user_id_semester_pk" PRIMARY KEY("user_id","semester")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"csrf" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"user_id" uuid NOT NULL,
	"semester" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"window" jsonb NOT NULL,
	"last_attempt" timestamp with time zone,
	"last_success" timestamp with time zone,
	"error" text,
	CONSTRAINT "snapshots_user_id_semester_pk" PRIMARY KEY("user_id","semester")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"semester" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "worker_status" (
	"id" text PRIMARY KEY NOT NULL,
	"heartbeat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_target_users_id_fk" FOREIGN KEY ("target") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_a_users_id_fk" FOREIGN KEY ("a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_b_users_id_fk" FOREIGN KEY ("b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_users_id_fk" FOREIGN KEY ("requester") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_viewer_users_id_fk" FOREIGN KEY ("viewer") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "sessions" USING btree ("user_id");