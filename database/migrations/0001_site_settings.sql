CREATE TABLE "site_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"support_url" text NOT NULL,
	"services" jsonb NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = true)
);
