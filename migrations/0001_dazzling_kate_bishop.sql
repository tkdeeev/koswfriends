CREATE TABLE "sharing_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"calendar" boolean DEFAULT false NOT NULL,
	"plans" boolean DEFAULT false NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id"),
	CONSTRAINT "member_status" CHECK ("group_members"."status" in ('pending', 'accepted'))
);
--> statement-breakpoint
CREATE TABLE "sharing_overrides" (
	"owner" uuid NOT NULL,
	"viewer" uuid NOT NULL,
	"calendar" boolean NOT NULL,
	"plans" boolean NOT NULL,
	CONSTRAINT "sharing_overrides_owner_viewer_pk" PRIMARY KEY("owner","viewer")
);
--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD CONSTRAINT "sharing_groups_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_overrides" ADD CONSTRAINT "sharing_overrides_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_overrides" ADD CONSTRAINT "sharing_overrides_viewer_users_id_fk" FOREIGN KEY ("viewer") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_members" USING btree ("user_id");