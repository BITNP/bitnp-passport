ALTER TABLE "jobs" DROP CONSTRAINT "membership_job_group";--> statement-breakpoint
ALTER TABLE "term_groups" DROP CONSTRAINT "term_groups_previous_group_id_managed_groups_group_id_fk";
--> statement-breakpoint
ALTER TABLE "job_items" ALTER COLUMN "operation" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."job_operation";--> statement-breakpoint
CREATE TYPE "public"."job_operation" AS ENUM('add', 'remove');--> statement-breakpoint
ALTER TABLE "job_items" ALTER COLUMN "operation" SET DATA TYPE "public"."job_operation" USING "operation"::"public"."job_operation";--> statement-breakpoint
DROP INDEX "one_rollover_job";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "payload";--> statement-breakpoint
ALTER TABLE "term_groups" DROP COLUMN "previous_group_id";--> statement-breakpoint
DROP TYPE "public"."job_kind";