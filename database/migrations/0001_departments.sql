CREATE TABLE "departments" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- 统一目录采用最新任期的名称，历史部门名称与未完成的创建计划原样保留。
-- 创建中断时部门可能只存在于 creation JSON，必须一并登记才能继续创建。
WITH definitions AS (
  SELECT g.code, g.department_name AS name, t.created_by, t.created_at,
         t.year, t.id AS term_id, g.group_id AS source_id
  FROM term_groups g
  JOIN terms t ON t.id = g.term_id
  UNION ALL
  SELECT g->>'code', g->>'departmentName', t.created_by, t.created_at,
         t.year, t.id, ''
  FROM terms t
  CROSS JOIN LATERAL jsonb_array_elements(t.creation->'groups') AS g
)
INSERT INTO departments (code, name, created_by, created_at)
SELECT DISTINCT ON (code) code, name, created_by, created_at
FROM definitions
ORDER BY code, year DESC, created_at DESC, term_id, source_id;
--> statement-breakpoint
ALTER TABLE "term_groups" ADD CONSTRAINT "term_groups_code_departments_code_fk" FOREIGN KEY ("code") REFERENCES "public"."departments"("code") ON DELETE no action ON UPDATE no action;