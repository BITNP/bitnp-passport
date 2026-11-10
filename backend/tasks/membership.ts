import { and, eq, inArray, ne } from "drizzle-orm";
import type { Job } from "pg-boss";

import { jobItems, jobs } from "#database/schema";
import type { TaskData } from "#shared/types";

import { audited } from "../audit.ts";
import { db, withIdentityLock } from "../database.ts";
import { ApplicationError, errorMessage } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { logger } from "../logger.ts";
import { requireGroupManager } from "../permissions.ts";

async function executeMembershipTask(task: Job<TaskData>, groupId: string) {
  const { jobId, queueId } = task.data;
  const currentRun = and(
    eq(jobs.id, jobId),
    eq(jobs.queueId, queueId),
    inArray(jobs.status, ["queued", "running"]),
  );

  const actor = { subject: task.data.actorSubject };

  try {
    await requireGroupManager(actor, groupId);

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
        let member = false;
        try {
          member = (await keycloak.groupsForUser(item.itemKey)).some(
            (group) => group.id === groupId,
          );
        } catch (error) {
          const alreadyRemoved =
            item.operation === "remove" &&
            error instanceof ApplicationError &&
            error.statusCode === 404;
          if (!alreadyRemoved) {
            throw error;
          }
        }

        if (item.operation === "add" && !member) {
          const user = await keycloak.user(item.itemKey);
          if (!user.enabled) {
            throw new ApplicationError(422, "不能添加已停用的用户");
          }
        }

        task.signal.throwIfAborted();

        const shouldExecute = await db.transaction(async (tx) => {
          // NO KEY UPDATE serializes task steps without blocking audit FK inserts.
          const [currentItem] = await tx
            .select({ status: jobItems.status })
            .from(jobItems)
            .innerJoin(jobs, eq(jobs.id, jobItems.jobId))
            .where(and(currentRun, itemCondition))
            .for("no key update");
          if (!currentItem || currentItem.status === "succeeded") {
            return false;
          }

          task.signal.throwIfAborted();

          const alreadyApplied = item.operation === "add" ? member : !member;
          if (alreadyApplied) {
            await tx
              .update(jobItems)
              .set({ status: "succeeded", error: null })
              .where(itemCondition);

            return false;
          }

          return true;
        });
        if (!shouldExecute) {
          continue;
        }

        await audited(
          actor,
          {
            operation: `job.${item.operation}`,
            jobId,
            groupId,
            target: { type: "user", id: item.itemKey },
          },
          () =>
            item.operation === "add"
              ? keycloak.addMember(item.itemKey, groupId)
              : keycloak.removeMember(item.itemKey, groupId),
        );

        await db
          .update(jobItems)
          .set({ status: "succeeded", error: null })
          .where(and(itemCondition, ne(jobItems.status, "succeeded")));
      } catch (error) {
        task.signal.throwIfAborted();

        const knownFailure =
          error instanceof ApplicationError && error.statusCode < 500;

        await db
          .update(jobItems)
          .set({
            status: knownFailure ? "failed" : "pending",
            error: errorMessage(error),
          })
          .where(and(itemCondition, ne(jobItems.status, "succeeded")));

        if (
          !knownFailure ||
          (error instanceof ApplicationError && error.statusCode === 403)
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
          error: incomplete ? "部分成员变更未完成，请按明细处理后重试" : null,
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

export const runMembershipTask = (task: Job<TaskData>, groupId: string) =>
  withIdentityLock(() => executeMembershipTask(task, groupId));
