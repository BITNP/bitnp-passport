DROP INDEX "one_rollover_job";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "queue_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "term_groups" ADD COLUMN "previous_group_id" text;--> statement-breakpoint
ALTER TABLE "term_groups" ADD CONSTRAINT "term_groups_previous_group_id_managed_groups_group_id_fk" FOREIGN KEY ("previous_group_id") REFERENCES "public"."managed_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_rollover_job" ON "jobs" USING btree ("kind") WHERE ("jobs"."kind" = 'rollover' and "jobs"."status" in ('queued', 'running', 'failed'));--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "cancel_requested";