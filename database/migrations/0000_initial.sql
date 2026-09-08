CREATE TYPE "public"."audit_outcome" AS ENUM('pending', 'succeeded', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."delegate_type" AS ENUM('user', 'group');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_operation" AS ENUM('add', 'remove');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."term_status" AS ENUM('draft', 'current', 'archived');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_subject" text NOT NULL,
	"operation" text NOT NULL,
	"group_id" text,
	"target" text,
	"job_id" uuid,
	"outcome" "audit_outcome" NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_delegations" (
	"group_id" text NOT NULL,
	"type" "delegate_type" DEFAULT 'user' NOT NULL,
	"subject" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_delegations_group_id_type_subject_pk" PRIMARY KEY("group_id","type","subject")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"group_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_token_unique" UNIQUE("token"),
	CONSTRAINT "invitation_expiry" CHECK ("invitations"."expires_at" > "invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "job_items" (
	"job_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"operation" "job_operation" NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	CONSTRAINT "job_items_job_id_item_key_operation_pk" PRIMARY KEY("job_id","item_key","operation")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue_id" uuid NOT NULL,
	"actor_subject" text NOT NULL,
	"group_id" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logout_tokens" (
	"jti" text PRIMARY KEY NOT NULL,
	"subject" text,
	"oidc_sid" text,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managed_groups" (
	"group_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"allow_invites" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_admins" (
	"subject" text PRIMARY KEY NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"oidc_sid" text,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"encrypted_tokens" text NOT NULL,
	"refresh_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_groups" (
	"term_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "term_groups_term_id_group_id_pk" PRIMARY KEY("term_id","group_id"),
	CONSTRAINT "term_groups_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"status" "term_status" DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_label_unique" UNIQUE("label")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_delegations" ADD CONSTRAINT "group_delegations_group_id_managed_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."managed_groups"("group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_group_id_managed_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."managed_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_group_id_managed_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."managed_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_groups" ADD CONSTRAINT "term_groups_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_groups" ADD CONSTRAINT "term_groups_group_id_managed_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."managed_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_group" ON "audit_events" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "delegation_subject" ON "group_delegations" USING btree ("type","subject");--> statement-breakpoint
CREATE INDEX "invitation_group" ON "invitations" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_actor" ON "jobs" USING btree ("actor_subject","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logout_subject" ON "logout_tokens" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "logout_sid" ON "logout_tokens" USING btree ("oidc_sid");--> statement-breakpoint
CREATE INDEX "logout_expiry" ON "logout_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_subject" ON "sessions" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "session_oidc_sid" ON "sessions" USING btree ("oidc_sid");--> statement-breakpoint
CREATE INDEX "session_expiry" ON "sessions" USING btree ("refresh_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_current_term" ON "terms" USING btree ("status") WHERE "terms"."status" = 'current';