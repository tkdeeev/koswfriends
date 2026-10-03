CREATE TABLE "calendar_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_snapshots" (
	"feed_id" uuid NOT NULL,
	"semester" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_attempt" timestamp with time zone NOT NULL,
	"last_success" timestamp with time zone,
	"error" text,
	CONSTRAINT "feed_snapshots_feed_id_semester_pk" PRIMARY KEY("feed_id","semester")
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "external_identities_provider_subject_pk" PRIMARY KEY("provider","subject")
);
--> statement-breakpoint
ALTER TABLE "oauth_attempts" ADD COLUMN "provider" text DEFAULT 'cvut' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_attempts" ADD COLUMN "verifier" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" text DEFAULT 'cvut' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "feed_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_snapshots" ADD CONSTRAINT "feed_snapshots_feed_id_calendar_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."calendar_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_user_url_idx" ON "calendar_feeds" USING btree ("user_id","url_hash");--> statement-breakpoint
CREATE INDEX "external_identity_user_idx" ON "external_identities" USING btree ("user_id");