CREATE TABLE "profile_pictures" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"image" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_version" uuid;--> statement-breakpoint
ALTER TABLE "profile_pictures" ADD CONSTRAINT "profile_pictures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;