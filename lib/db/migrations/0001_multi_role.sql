CREATE TABLE "user_role" (
	"userId" text NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_userId_role_pk" PRIMARY KEY("userId","role")
);
--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_role" ("userId", "role", "createdAt")
SELECT "id", "role", NOW() FROM "user" WHERE "role" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";