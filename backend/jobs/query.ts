import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { jobItems, jobs, managedGroups } from "#database/schema";
import type { JobData, JobResult } from "#shared/jobs";
import { jobOperationLabels } from "#shared/labels";
import type { Actor } from "#shared/types";

import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { groupAccess } from "../permissions.ts";
import { pick } from "../utils.ts";
import { jobPolicies } from "./policy.ts";

const retryAction = {
  name: "retry" as const,
  label: "重试",
  confirmation: "重试未完成的操作？",
};

const cancelAction = {
  name: "cancel" as const,
  label: "取消任务",
  confirmation: "取消尚未完成的操作？已完成的变更会保留",
};

interface JobItem {
  key: string;
  label: string;
  target: { label: string; to: string | null } | null;
  status: typeof jobItems.$inferSelect.status | JobResult["outcome"];
  error: string | null;
}

async function jobGroups(
  ids: string[],
  { administrator, groupIds }: Awaited<ReturnType<typeof groupAccess>>,
) {
  const settings = await db
    .select({ groupId: managedGroups.groupId, label: managedGroups.label })
    .from(managedGroups)
    .where(inArray(managedGroups.groupId, ids));
  const labels = new Map(settings.map((group) => [group.groupId, group.label]));

  return new Map(
    await Promise.all(
      [...new Set(ids)].map(async (id) => {
        let label = labels.get(id);

        if (label === undefined) {
          try {
            label = (await keycloak.group(id)).name;
          } catch (error) {
            if (
              !(error instanceof ApplicationError) ||
              error.statusCode !== 404
            ) {
              throw error;
            }
          }
        }

        return [
          id,
          {
            label: label ?? id,
            to:
              label !== undefined && (administrator || groupIds.includes(id))
                ? `/groups/${encodeURIComponent(id)}`
                : null,
          },
        ] as const;
      }),
    ),
  );
}

export async function listJobs(actor: Actor, first: number, groupId?: string) {
  const access = await groupAccess(actor);
  const visible = and(
    access.administrator ? undefined : eq(jobs.actorSubject, actor.subject),
    groupId ? eq(jobs.groupId, groupId) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        id: jobs.id,
        type: sql<JobData["type"]>`${jobs.data}->>'type'`,
        status: jobs.status,
        groupId: jobs.groupId,
        actorSubject: jobs.actorSubject,
        createdAt: jobs.createdAt,
        error: jobs.error,
      })
      .from(jobs)
      .where(visible)
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .offset(first)
      .limit(50),
    db.$count(jobs, visible),
  ]);

  const groups = await jobGroups(
    rows.map((row) => row.groupId),
    access,
  );

  return {
    jobs: rows.map(({ type, ...row }) => ({
      ...row,
      title: jobPolicies[type].title,
      group: groups.get(row.groupId)!,
    })),
    total,
  };
}

export async function jobDetail(actor: Actor, id: string) {
  const access = await groupAccess(actor);
  const { administrator } = access;
  const job = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.id, id),
      administrator ? undefined : eq(jobs.actorSubject, actor.subject),
    ),
  });

  if (!job) {
    throw new ApplicationError(404, "任务不存在或你没有查看权限");
  }

  const groups = await jobGroups([job.groupId], access);
  const definition = jobPolicies[job.data.type];
  const active = job.status === "queued" || job.status === "running";
  let items: JobItem[];
  let total: number;

  switch (job.data.type) {
    case "membership": {
      const rows = await db
        .select()
        .from(jobItems)
        .where(eq(jobItems.jobId, id))
        .orderBy(jobItems.operation, jobItems.itemKey);

      items = rows.map((item) => ({
        key: `${item.operation}:${item.itemKey}`,
        label: jobOperationLabels[item.operation],
        target: {
          label: item.itemKey,
          to:
            item.itemKey === actor.subject
              ? "/account"
              : administrator
                ? `/admin/users/${encodeURIComponent(item.itemKey)}`
                : null,
        },
        status: item.status,
        error: item.error,
      }));
      total = items.length;

      break;
    }
    case "handover": {
      items = job.results.map((result, index) => ({
        key: String(index),
        label: result.label,
        target: null,
        status: result.outcome,
        error: result.error ?? null,
      }));
      total = job.data.total;

      break;
    }
  }

  return {
    job: {
      ...pick(job, [
        "id",
        "groupId",
        "status",
        "error",
        "startedAt",
        "createdAt",
        "updatedAt",
      ]),
      title: definition.title,
      group: groups.get(job.groupId)!,
    },
    items,
    total,
    completed: items.filter((item) => item.status === "succeeded").length,
    actions: [
      ...(job.status === "failed" &&
      definition.retryable &&
      (administrator || access.groupIds.includes(job.groupId))
        ? [retryAction]
        : []),
      ...(definition.cancelStatuses.has(job.status) ? [cancelAction] : []),
    ],
    notice: job.status === "failed" ? definition.failureNotice : null,
    followup: !active && administrator ? definition.followup : null,
  };
}
