CREATE TABLE "subject_boards" (
	"user_id" uuid NOT NULL,
	"semester" text NOT NULL,
	"course" text NOT NULL,
	"title" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "subject_boards_user_id_semester_course_pk" PRIMARY KEY("user_id","semester","course")
);
--> statement-breakpoint
ALTER TABLE "subject_boards" ADD CONSTRAINT "subject_boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;