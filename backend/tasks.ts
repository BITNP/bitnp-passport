import assert from "node:assert/strict";

import { and, eq, inArray, lt, ne } from "drizzle-orm";
import type { Job } from "pg-boss";

import {
  auditEvents,
  jobItems,
  jobs,
  logoutTokens,
  sessions,
} from "#database/schema";
import type { TaskData } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError, errorMessage } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { logger } from "./logger.ts";
import { requireGroupManager } from "./permissions.ts";

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

  const actor = { subject: task.data.actorSubject };

  try {
    const items = await db
      .select()
      .from(jobItems)
      .where(and(eq(jobItems.jobId, jobId), ne(jobItems.status, "succeeded")))
      .orderBy(jobItems.operation, jobItems.itemKey);

    for (const item of items) {
      const itemCondition = and(
        eq(jobItems.jobId, jobId),
        eq(jobItems.itemKey, item.itemKey),
        eq(jobItems.operation, item.operation),
      );

      try {
        const proceed = await db.transaction(async (tx) => {
          // Audit inserts use a separate connection and take a foreign-key KEY SHARE lock.
          // NO KEY UPDATE serializes task steps without blocking those inserts.
          const [active] = await tx
            .select()
            .from(jobs)
            .where(currentRun)
            .for("no key update");
          if (!active) {
            return false;
          }

          await requireGroupManager(actor, job.groupId);

          const saved = await tx.query.jobItems.findFirst({
            where: itemCondition,
          });
          assert.ok(saved);
          if (saved.status === "succeeded") {
            return true;
          }

          await audited(
            actor,
            {
              operation: `job.${item.operation}`,
              jobId,
              groupId: job.groupId,
              target: item.itemKey,
            },
            async () => {
              if (item.operation === "add") {
                const user = await keycloak.user(item.itemKey);
                if (!user.enabled) {
                  throw new ApplicationError(422, "不能添加已停用的用户");
                }

                task.signal.throwIfAborted();
                await keycloak.addMember(item.itemKey, job.groupId);
              } else {
                task.signal.throwIfAborted();
                await keycloak.removeMember(item.itemKey, job.groupId);
              }
            },
          );

          task.signal.throwIfAborted();
          await tx
            .update(jobItems)
            .set({ status: "succeeded", error: null })
            .where(itemCondition);

          return true;
        });
        if (!proceed) {
          return;
        }
      } catch (error) {
        task.signal.throwIfAborted();
        await db
          .update(jobItems)
          .set({ status: "failed", error: errorMessage(error) })
          .where(and(itemCondition, ne(jobItems.status, "succeeded")));

        if (
          !(error instanceof ApplicationError) ||
          error.statusCode >= 500 ||
          error.statusCode === 403
        ) {
          throw error;
        }
      }
    }

    await db.transaction(async (tx) => {
      const [active] = await tx
        .select()
        .from(jobs)
        .where(currentRun)
        .for("update");
      if (!active) {
        return;
      }

      task.signal.throwIfAborted();
      const incomplete = await tx.query.jobItems.findFirst({
        where: and(eq(jobItems.jobId, jobId), ne(jobItems.status, "succeeded")),
      });
      await tx
        .update(jobs)
        .set({
          status: incomplete ? "failed" : "succeeded",
          error: incomplete
            ? "部分成员变更失败，请查看明细并在处理后重试"
            : null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
    });
  } catch (error) {
    task.signal.throwIfAborted();
    const permanent =
      error instanceof ApplicationError && error.statusCode < 500;

    await db
      .update(jobs)
      .set({
        status: permanent ? "failed" : "running",
        error: errorMessage(error),
        updatedAt: new Date(),
      })
      .where(currentRun);

    if (!permanent) {
      throw error;
    }

    logger.warn(
      { err: error, component: "worker", jobId, queueId },
      "任务无法继续",
    );
  }
}

export async function failTask(task: TaskData) {
  await db
    .update(jobs)
    .set({
      status: "failed",
      error: "后台执行多次失败或中断，请查看明细并重试",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobs.id, task.jobId),
        eq(jobs.queueId, task.queueId),
        inArray(jobs.status, ["queued", "running"]),
      ),
    );
}

export async function cleanupExpiredRecords() {
  const now = new Date();

  await db.delete(sessions).where(lt(sessions.refreshExpiresAt, now));
  await db.delete(logoutTokens).where(lt(logoutTokens.expiresAt, now));
}
