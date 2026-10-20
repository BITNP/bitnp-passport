import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";

import type { AuditRecord } from "#database/schema";
import { auditEvents, jobItems, jobs } from "#database/schema";
import type { AuditDetail } from "#shared/events";
import type { JobData } from "#shared/jobs";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { jobPolicies } from "./jobs/policy.ts";
import { isAdministrator, requireGroupManager } from "./permissions.ts";
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

const readableBy = async (actor: Actor) =>
  (await isAdministrator(actor))
    ? undefined
    : eq(jobs.actorSubject, actor.subject);

export async function retryJob(actor: Actor, id: string) {
  const queueId = randomUUID();

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), await readableBy(actor)))
      .for("update");

    if (!job) {
      throw new ApplicationError(404, "任务不存在或你没有查看权限");
    }

    if (!jobPolicies[job.data.type].retryable) {
      throw new ApplicationError(409, "请核对任务结果后重新安排。");
    }

    await requireGroupManager(actor, job.groupId);

    if (job.status !== "failed") {
      throw new ApplicationError(409, "只有失败的任务可以重试");
    }

    const boss = await queue();

    await tx
      .update(jobs)
      .set({ status: "queued", error: null, queueId, updatedAt: new Date() })
      .where(eq(jobs.id, id));

    await tx
      .update(jobItems)
      .set({ status: "pending", error: null })
      .where(and(eq(jobItems.jobId, id), eq(jobItems.status, "failed")));

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
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), await readableBy(actor)))
      .for("update");

    if (!job) {
      throw new ApplicationError(404, "任务不存在或你没有查看权限");
    }

    if (!jobPolicies[job.data.type].cancelStatuses.has(job.status)) {
      throw new ApplicationError(409, "此任务当前无法取消");
    }

    await tx
      .update(jobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(jobs.id, id));

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
