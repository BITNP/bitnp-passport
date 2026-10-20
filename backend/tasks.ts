import { and, eq, inArray } from "drizzle-orm";
import type { Job } from "pg-boss";

import { auditEvents, jobs } from "#database/schema";
import type { TaskData } from "#shared/types";

import { db } from "./database.ts";
import { runHandoverTask } from "./tasks/handover.ts";
import { runMembershipTask } from "./tasks/membership.ts";

export async function runTask(task: Job<TaskData>) {
  const { jobId, queueId } = task.data;
  const currentRun = and(
    eq(jobs.id, jobId),
    eq(jobs.queueId, queueId),
    inArray(jobs.status, ["queued", "running"]),
  );

  const job = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(jobs).where(currentRun).for("update");
    if (!row) {
      return null;
    }

    task.signal.throwIfAborted();
    await tx
      .update(jobs)
      .set({
        status: "running",
        startedAt: row.startedAt ?? new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    // A worker can stop after Keycloak succeeds but before recording the result.
    await tx
      .update(auditEvents)
      .set({
        outcome: "unknown",
        completedAt: new Date(),
        error: "上次执行结果未记录",
      })
      .where(
        and(eq(auditEvents.jobId, jobId), eq(auditEvents.outcome, "pending")),
      );

    return row;
  });
  if (!job) {
    return;
  }

  switch (job.data.type) {
    case "membership": {
      return runMembershipTask(task, job.groupId);
    }
    case "handover": {
      return runHandoverTask(task, job.data.input);
    }
  }
}

export async function failTask(task: TaskData) {
  await db.transaction(async (tx) => {
    const [failed] = await tx
      .update(jobs)
      .set({
        status: "failed",
        error: "后台任务失败或中断，请核对任务明细；已完成的变更会保留",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobs.id, task.jobId),
          eq(jobs.queueId, task.queueId),
          inArray(jobs.status, ["queued", "running"]),
        ),
      )
      .returning({ id: jobs.id });
    if (failed) {
      await tx
        .update(auditEvents)
        .set({
          outcome: "unknown",
          completedAt: new Date(),
          error: "后台执行中断，外部变更结果需核对",
        })
        .where(
          and(
            eq(auditEvents.jobId, failed.id),
            eq(auditEvents.outcome, "pending"),
          ),
        );
    }
  });
}
