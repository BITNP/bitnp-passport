import { and, eq } from "drizzle-orm";
import type { Job } from "pg-boss";

import { jobs } from "#database/schema";
import { activeOrganizationRole, roleLabel } from "#shared/identity";
import type { JobData, JobResult } from "#shared/jobs";
import type { TaskData } from "#shared/types";
import { userLabel } from "#shared/user";

import { previewAssignment } from "../appointments.ts";
import { audited } from "../audit.ts";
import { db, withIdentityLock } from "../database.ts";
import { ApplicationError, errorMessage } from "../errors.ts";
import { previewHandover } from "../handover.ts";
import { closeGroupInvitations } from "../invitations/revocation.ts";
import { setGroupRole, setUserRole } from "../keycloak/roles.ts";

type HandoverJobData = Extract<JobData, { type: "handover" }>;

export const runHandoverTask = (task: Job<TaskData>, data: HandoverJobData) =>
  withIdentityLock(async () => {
    const currentRun = and(
      eq(jobs.id, task.data.jobId),
      eq(jobs.queueId, task.data.queueId),
      eq(jobs.status, "running"),
    );

    const actor = { subject: task.data.actorSubject };
    const results: JobResult[] = [];
    const saveProgress = () =>
      db.update(jobs).set({ results, updatedAt: new Date() }).where(currentRun);

    try {
      task.signal.throwIfAborted();
      const preview = await previewHandover(actor, data.input);

      await db
        .update(jobs)
        .set({
          data: {
            ...data,
            total: preview.changes.length + preview.groupChanges.length + 1,
          },
          updatedAt: new Date(),
        })
        .where(currentRun);

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
          },
        },
        async () => {
          async function perform(label: string, run: () => Promise<unknown>) {
            task.signal.throwIfAborted();

            try {
              await run();
              task.signal.throwIfAborted();
            } catch (cause) {
              const knownFailure =
                cause instanceof ApplicationError && cause.statusCode < 500;
              results.push({
                label,
                outcome: knownFailure ? "failed" : "pending",
                error: errorMessage(cause),
              });
              await saveProgress();

              throw new ApplicationError(
                knownFailure ? 409 : 503,
                "换届未完成。",
                { cause },
              );
            }

            results.push({ label, outcome: "succeeded" });
            await saveProgress();
          }

          await perform("关闭前届邀请", () =>
            closeGroupInvitations(preview.previousGroups),
          );

          const groupGrants = preview.groupChanges.filter(
            (change) =>
              change.assigned && change.role !== activeOrganizationRole,
          );
          const groupRevokes = preview.groupChanges.filter(
            (change) =>
              !change.assigned && change.role !== activeOrganizationRole,
          );
          const activeMarkerChanges = [
            ...preview.groupChanges.filter(
              (change) =>
                change.role === activeOrganizationRole && !change.assigned,
            ),
            ...preview.groupChanges.filter(
              (change) =>
                change.role === activeOrganizationRole && change.assigned,
            ),
          ];

          // Establish every new source before revoking anything. The active
          // marker is switched last so there is never more than one current root.
          for (const change of groupGrants) {
            await perform(change.label, () =>
              setGroupRole(change.groupId, change.role, true),
            );
          }

          for (const change of preview.changes.filter(
            (change) => change.assigned,
          )) {
            await perform(
              `任命 ${userLabel(change.preview.user)}：${roleLabel(change.role)}`,
              async () => {
                await previewAssignment(change.subject, {
                  role: change.role,
                  assigned: true,
                  previouslyAssigned: false,
                });

                await setUserRole(change.subject, change.role, true);
              },
            );
          }

          for (const change of preview.changes.filter(
            (change) => !change.assigned,
          )) {
            await perform(
              `撤销 ${userLabel(change.preview.user)}：${roleLabel(change.role)}`,
              async () => {
                await previewAssignment(change.subject, {
                  role: change.role,
                  assigned: false,
                  previouslyAssigned: true,
                });

                await setUserRole(change.subject, change.role, false);
              },
            );
          }

          for (const change of groupRevokes) {
            await perform(change.label, () =>
              setGroupRole(change.groupId, change.role, false),
            );
          }

          for (const change of activeMarkerChanges) {
            await perform(change.label, () =>
              setGroupRole(change.groupId, change.role, change.assigned),
            );
          }
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
