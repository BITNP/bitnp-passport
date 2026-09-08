CREATE TYPE "public"."delegate_type" AS ENUM('user', 'group');--> statement-breakpoint
DROP INDEX "delegation_subject";--> statement-breakpoint
ALTER TABLE "group_delegations" DROP CONSTRAINT "group_delegations_group_id_subject_pk";--> statement-breakpoint
ALTER TABLE "group_delegations" ADD COLUMN "type" "delegate_type" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_delegations" ADD CONSTRAINT "group_delegations_group_id_type_subject_pk" PRIMARY KEY("group_id","type","subject");--> statement-breakpoint
CREATE INDEX "delegation_subject" ON "group_delegations" USING btree ("type","subject");
