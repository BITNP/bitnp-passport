ALTER TABLE "logout_tokens" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "logout_tokens" ADD COLUMN "oidc_sid" text;--> statement-breakpoint
ALTER TABLE "logout_tokens" ADD COLUMN "issued_at" timestamp with time zone NOT NULL;--> statement-breakpoint
CREATE INDEX "logout_subject" ON "logout_tokens" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "logout_sid" ON "logout_tokens" USING btree ("oidc_sid");--> statement-breakpoint
CREATE INDEX "logout_expiry" ON "logout_tokens" USING btree ("expires_at");