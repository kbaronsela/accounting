ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "inviteeDisplayName" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_tokenHash_unique" ON "invitation" ("tokenHash");
