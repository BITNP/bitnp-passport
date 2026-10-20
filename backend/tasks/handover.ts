import { and, eq } from "drizzle-orm";
import type { Job } from "pg-boss";

import { jobs } from "#database/schema";
import type { HandoverInput } from "#shared/handover";
import { roleLabel } from "#shared/identity";
import type { JobResult } from "#shared/jobs";
import type { TaskData } from "#shared/types";

import { previewAssignment } from "../appointments.ts";
import { audited } from "../audit.ts";
import { config } from "../config.ts";
import { db, withIdentityLock } from "../database.ts";
import { ApplicationError, errorMessage } from "../errors.ts";
import { previewHandover } from "../handover.ts";
import { closeGroupInvitations } from "../invitations/revocation.ts";
import { setGroupRole, setUserRole } from "../keycloak/roles.ts";

export const runHandoverTask = (task: Job<TaskData>, input: HandoverInput) =>
  withIdentityLock(async () => {
    const currentRun = and(
      eq(jobs.id, task.data.jobId),
      eq(jobs.queueId, task.data.queueId),
      eq(jobs.status, "running"),
    );

    if (!(await db.query.jobs.findFirst({ where: currentRun }))) {
      return;
    }

    const actor = { subject: task.data.actorSubject };
    const results: JobResult[] = [];
    const saveProgress = () =>
      db.update(jobs).set({ results, updatedAt: new Date() }).where(currentRun);

    try {
      task.signal.throwIfAborted();
      const preview = await previewHandover(actor, input);

      await audited(
        actor,
        {
          operation: "handover.execute",
          jobId: task.data.jobId,
          groupId: preview.next.id,
          target: { type: "group", id: preview.next.id },
          detail: {
            previousRootId: preview.previous.id,
            nextRootId: preview.next.id,
            results,
          },
        },
        async () => {
          async function perform(label: string, run: () => Promise<unknown>) {
            try {
              task.signal.throwIfAborted();
              await run();
              task.signal.throwIfAborted();
            } catch (cause) {
              results.push({
                label,
                outcome:
                  cause instanceof ApplicationError && cause.statusCode < 500
                    ? "failed"
                    : "unknown",
                error: errorMessage(cause),
              });
              await saveProgress();

              throw new ApplicationError(409, "换届未完成。", { cause });
            }

            results.push({ label, outcome: "succeeded" });
            await saveProgress();
          }

          await perform("关闭前届邀请", () =>
            closeGroupInvitations(preview.previousGroups),
          );

          for (const assigned of [true, false]) {
            for (const change of preview.changes.filter(
              (change) => change.assigned === assigned,
            )) {
              await perform(
                `${assigned ? "任命" : "撤销"} ${change.preview.user.username}：${roleLabel(change.role)}`,
                async () => {
                  await previewAssignment(change.subject, {
                    role: change.role,
                    assigned,
                    previouslyAssigned: !assigned,
                  });

                  await setUserRole(change.subject, change.role, assigned);
                },
              );
            }
          }

          for (const member of preview.members) {
            await perform(`接入新届${member.label}成员身份`, () =>
              setGroupRole(member.next.id, member.role, true),
            );
            await perform(`移除前届${member.label}成员身份`, () =>
              setGroupRole(member.previous.id, member.role, false),
            );
          }

          await perform("接入新届现任标记", () =>
            setGroupRole(preview.next.id, config.activeRole, true),
          );
          await perform("移除前届现任标记", () =>
            setGroupRole(preview.previous.id, config.activeRole, false),
          );
        },
      );

      await db
        .update(jobs)
        .set({ status: "succeeded", error: null, updatedAt: new Date() })
        .where(currentRun);
    } catch (error) {
      await db
        .update(jobs)
        .set({
          status: "failed",
          error: errorMessage(error),
          updatedAt: new Date(),
        })
        .where(currentRun);

      throw error;
    }
  });
