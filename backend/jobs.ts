import { randomUUID } from "node:crypto";

import { and, desc, eq, exists, or, sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";

import type { AuditRecord } from "#database/schema";
import {
  auditEvents,
  jobItems,
  jobs,
  managedGroups,
  portalAdmins,
} from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireGroupManager } from "./permissions.ts";
import { operationQueue, queue } from "./queue.ts";

export async function createMembershipJob(
  actor: Actor,
  groupId: string,
  subjects: string[],
  operation: "add" | "remove",
) {
  await requireGroupManager(actor, groupId);
  await keycloak.group(groupId);

  const boss = await queue();
  const id = randomUUID();
  const queueId = randomUUID();
  const members = [...new Set(subjects)];

  await db.transaction(async (tx) => {
    await tx.insert(jobs).values({
      id,
      queueId,
      actorSubject: actor.subject,
      groupId,
    });

    await tx.insert(jobItems).values(
      members.map((itemKey) => ({
        jobId: id,
        itemKey,
        operation,
      })),
    );

    await boss.send(
      operationQueue,
      { jobId: id, queueId, actorSubject: actor.subject },
      { id: queueId, group: { id: groupId }, db: fromDrizzle(tx, sql) },
    );

    await tx.insert(auditEvents).values({
      actorSubject: actor.subject,
      operation: "job.create",
      jobId: id,
      groupId,
      outcome: "succeeded",
      completedAt: new Date(),
      detail: { operation, count: members.length },
    } satisfies AuditRecord);
  });

  return { id };
}

const readableBy = (actor: Actor) =>
  or(
    eq(jobs.actorSubject, actor.subject),
    exists(
      db
        .select({ subject: portalAdmins.subject })
        .from(portalAdmins)
        .where(eq(portalAdmins.subject, actor.subject)),
    ),
  );

export async function listJobs(actor: Actor, first: number, groupId?: string) {
  const visible = and(
    readableBy(actor),
    groupId ? eq(jobs.groupId, groupId) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        id: jobs.id,
        status: jobs.status,
        groupId: jobs.groupId,
        groupLabel: managedGroups.label,
        actorSubject: jobs.actorSubject,
        createdAt: jobs.createdAt,
        error: jobs.error,
      })
      .from(jobs)
      .leftJoin(managedGroups, eq(jobs.groupId, managedGroups.groupId))
      .where(visible)
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .offset(first)
      .limit(50),
    db.$count(jobs, visible),
  ]);

  const missingGroupIds = new Set(
    rows.filter((row) => row.groupLabel === null).map((row) => row.groupId),
  );
  const groupNames = await Promise.all(
    [...missingGroupIds].map(async (id) => {
      try {
        return { id, label: (await keycloak.group(id)).name };
      } catch (error) {
        // 群组删除后仍保留历史任务
        if (error instanceof ApplicationError && error.statusCode === 404) {
          return { id, label: id };
        }

        throw error;
      }
    }),
  );

  return {
    jobs: rows.map((row) => ({
      ...row,
      groupLabel:
        row.groupLabel ??
        groupNames.find((group) => group.id === row.groupId)!.label,
    })),
    total,
  };
}

export async function jobDetail(actor: Actor, id: string) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, id), readableBy(actor)),
  });
  if (!job) {
    throw new ApplicationError(404, "任务不存在或你没有查看权限");
  }

  const items = await db
    .select()
    .from(jobItems)
    .where(eq(jobItems.jobId, id))
    .orderBy(jobItems.operation, jobItems.itemKey);

  return {
    job,
    items,
    completed: items.filter((item) => item.status === "succeeded").length,
  };
}

export async function retryJob(actor: Actor, id: string) {
  const queueId = randomUUID();

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), readableBy(actor)))
      .for("update");
    if (!job) {
      throw new ApplicationError(404, "任务不存在或你没有查看权限");
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
      .where(and(eq(jobs.id, id), readableBy(actor)))
      .for("update");
    if (!job) {
      throw new ApplicationError(404, "任务不存在或你没有查看权限");
    }

    if (["cancelled", "succeeded"].includes(job.status)) {
      throw new ApplicationError(409, "此任务已结束");
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
