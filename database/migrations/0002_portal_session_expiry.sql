ALTER TABLE "sessions" RENAME COLUMN "refresh_expires_at" TO "expires_at";--> statement-breakpoint
UPDATE "sessions" SET "expires_at" = CURRENT_TIMESTAMP + INTERVAL '14 days';--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires_at" SET NOT NULL;
