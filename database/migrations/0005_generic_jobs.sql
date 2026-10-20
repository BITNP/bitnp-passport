ALTER TABLE "jobs" ADD COLUMN "data" jsonb DEFAULT '{"type":"membership"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "results" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "data" DROP DEFAULT;
