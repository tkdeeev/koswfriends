CREATE TABLE "personal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" uuid NOT NULL,
	"semester" text NOT NULL,
	"details" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_events" ADD CONSTRAINT "personal_events_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_event_owner_semester_idx" ON "personal_events" USING btree ("owner","semester");