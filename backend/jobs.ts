import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";

import type { AuditRecord } from "#database/schema";
import { auditEvents, jobItems, jobs } from "#database/schema";
import type { AuditDetail } from "#shared/events";
import type { JobData } from "#shared/jobs";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { jobPolicies } from "./jobs/policy.ts";
import { groupAccess } from "./permissions.ts";
import { operationQueue, queue } from "./queue.ts";

interface NewJob {
  groupId: string;
  data: JobData;
  items: Pick<typeof jobItems.$inferInsert, "itemKey" | "operation">[];
  detail: AuditDetail<"job.create">;
}

export async function createJob(actor: Actor, input: NewJob) {
  const boss = await queue();
  const id = randomUUID();
  const queueId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(jobs).values({
      id,
      queueId,
      actorSubject: actor.subject,
      groupId: input.groupId,
      data: input.data,
    });

    if (input.items.length > 0) {
      await tx
        .insert(jobItems)
        .values(input.items.map((item) => ({ jobId: id, ...item })));
    }

    await boss.send(
      operationQueue,
      { jobId: id, queueId, actorSubject: actor.subject },
      {
        id: queueId,
        group: {
          id: input.data.type === "handover" ? "bitnp-handover" : input.groupId,
        },
        ...(input.data.type === "handover" ? { retryLimit: 0 } : {}),
        db: fromDrizzle(tx, sql),
      },
    );

    await tx.insert(auditEvents).values({
      actorSubject: actor.subject,
      operation: "job.create",
      jobId: id,
      groupId: input.groupId,
      outcome: "succeeded",
      completedAt: new Date(),
      detail: input.detail,
    } satisfies AuditRecord);
  });

  return { id };
}

async function jobAccess(actor: Actor, id: string) {
  const access = await groupAccess(actor);
  const job = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.id, id),
      access.administrator ? undefined : eq(jobs.actorSubject, actor.subject),
    ),
  });
  if (!job) {
    throw new ApplicationError(404, "任务不存在或你没有查看权限");
  }

  return {
    job,
    access,
    canManage: access.administrator || access.groupIds.includes(job.groupId),
  };
}

async function manageableJob(actor: Actor, id: string) {
  const { job, canManage } = await jobAccess(actor, id);
  if (!canManage) {
    throw new ApplicationError(403, "你没有管理此组的权限");
  }

  return job;
}

export { jobAccess };

export async function retryJob(actor: Actor, id: string) {
  const job = await manageableJob(actor, id);
  if (!jobPolicies[job.data.type].retryable) {
    throw new ApplicationError(409, "请核对任务结果后重新安排。");
  }
  if (job.status !== "failed") {
    throw new ApplicationError(409, "只有失败的任务可以重试");
  }

  const boss = await queue();
  const queueId = randomUUID();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(jobs)
      .set({
        status: "queued",
        error: null,
        queueId,
        startedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, id), eq(jobs.status, "failed")))
      .returning({ id: jobs.id });
    if (!updated) {
      throw new ApplicationError(409, "任务状态已变化，请刷新后重试");
    }

    await tx
      .update(jobItems)
      .set({ status: "pending", error: null })
      .where(
        and(
          eq(jobItems.jobId, id),
          inArray(jobItems.status, ["failed", "pending"]),
        ),
      );

    await boss.send(
      operationQueue,
      { jobId: id, queueId, actorSubject: actor.subject },
      {
        id: queueId,
        group: { id: job.groupId },
        db: fromDrizzle(tx, sql),
      },
    );

    await tx.insert(auditEvents).values({
      actorSubject: actor.subject,
      operation: "job.retry",
      jobId: id,
      groupId: job.groupId,
      outcome: "succeeded",
      completedAt: new Date(),
    } satisfies AuditRecord);
  });
}

export async function cancelJob(actor: Actor, id: string) {
  const job = await manageableJob(actor, id);
  if (!jobPolicies[job.data.type].cancelStatuses.has(job.status)) {
    throw new ApplicationError(409, "此任务当前无法取消");
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(jobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(jobs.id, id),
          inArray(jobs.status, [...jobPolicies[job.data.type].cancelStatuses]),
        ),
      )
      .returning({ id: jobs.id });
    if (!updated) {
      throw new ApplicationError(409, "任务状态已变化，请刷新后重试");
    }

    await tx.insert(auditEvents).values({
      actorSubject: actor.subject,
      operation: "job.cancel",
      jobId: id,
      groupId: job.groupId,
      outcome: "succeeded",
      completedAt: new Date(),
    } satisfies AuditRecord);
  });
}
