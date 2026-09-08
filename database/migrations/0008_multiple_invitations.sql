-- Existing invitations are retired; old URLs are not supported.
UPDATE "invitations" SET "revoked_at" = now() WHERE "revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "invitations" RENAME COLUMN "token_hash" TO "token";--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_token_hash_unique";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_token_unique" UNIQUE("token");