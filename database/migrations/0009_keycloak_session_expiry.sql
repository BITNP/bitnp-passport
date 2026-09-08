DROP INDEX "session_expiry";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "refresh_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "session_expiry" ON "sessions" USING btree ("refresh_expires_at");--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "absolute_expires_at";--> statement-breakpoint
-- Refresh existing sessions on their next request to obtain Keycloak's expiry and replace the old Cookie lifetime.
UPDATE "sessions" SET "refresh_at" = now();
