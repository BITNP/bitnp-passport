import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import {
  groupDelegations,
  invitations,
  managedGroups,
  terms,
} from "#database/schema";
import type { Actor, TermActivationPlan } from "#shared/types";

import { audited } from "../audit.ts";
import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { requireAdministrator } from "../permissions.ts";
import type { DatabaseReader } from "./shared.ts";
import { belongsTo, directory, readCreatedTerm, termRoot } from "./shared.ts";

type Delegation = Pick<
  typeof groupDelegations.$inferSelect,
  "groupId" | "type" | "subject"
>;
interface DelegationTransfer {
  key: string;
  to: Delegation;
  groupLabel: string;
  subjectLabel: string;
}

export const activationInput = z.object({
  previousTermId: z.uuid().optional(),
  delegations: z.array(z.string()),
});

async function planActivation(
  id: string,
  previousTermId?: string,
  connection: DatabaseReader = db,
) {
  const next = await readCreatedTerm(id, connection);
  const current = await connection.query.terms.findFirst({
    where: eq(terms.status, "current"),
  });
  if (
    !next.activation &&
    previousTermId &&
    current &&
    current.id !== previousTermId
  ) {
    throw new ApplicationError(409, "前任任期与当前任期不一致");
  }
  const previousId = next.activation
    ? next.activation.previousTermId
    : (previousTermId ?? current?.id);
  const previous = previousId
    ? await readCreatedTerm(previousId, connection)
    : null;
  const active = await keycloak.activeRoleGroups();
  const nodes = directory(active.tree);
  const nextRoot = termRoot(nodes, next.rootGroupId);
  const previousRoot = previous ? termRoot(nodes, previous.rootGroupId) : null;
  const previousGroupIds =
    next.activation?.previousGroupIds ??
    (previousRoot ? [...directory([previousRoot]).keys()] : []);
  const blockedBy: string[] = [];
  if (next.status !== "draft") {
    blockedBy.push("只能启用草稿任期");
  }
  if (
    previousRoot &&
    (belongsTo(nextRoot.path, previousRoot.path) ||
      belongsTo(previousRoot.path, nextRoot.path))
  ) {
    blockedBy.push("前后任期必须使用互不重叠的群组树");
  }
  if (previous && next.year <= previous.year) {
    blockedBy.push("新任期年份必须晚于前任任期");
  }
  if (previousRoot) {
    for (const node of nodes.values()) {
      if (
        belongsTo(node.path, previousRoot.path) ||
        belongsTo(previousRoot.path, node.path)
      ) {
        const source = await keycloak.groupActiveRoleSource(
          node.id,
          active.role.id!,
        );
        if (
          source.composite ||
          (source.direct && !previousGroupIds.includes(node.id))
        ) {
          blockedBy.push(
            `旧任期仍从此群组继承现任角色，请先在 Keycloak 调整：${node.path}`,
          );
        }
      }
    }
  }

  const affected = or(
    inArray(groupDelegations.groupId, previousGroupIds),
    and(
      eq(groupDelegations.type, "group"),
      inArray(groupDelegations.subject, previousGroupIds),
    ),
  );
  const [grants, settings, invitationCount] = await Promise.all([
    connection.select().from(groupDelegations).where(affected).for("update"),
    connection.select().from(managedGroups),
    connection.$count(
      invitations,
      and(
        inArray(invitations.groupId, previousGroupIds),
        isNull(invitations.revokedAt),
      ),
    ),
  ]);
  const replacements = new Map<string, string>();
  if (previous) {
    replacements.set(previous.rootGroupId, next.rootGroupId);
    for (const group of previous.groups) {
      const replacement = next.groups.find((item) => item.code === group.code);
      if (replacement) {
        replacements.set(group.groupId, replacement.groupId);
      }
    }
  }
  const transfers: DelegationTransfer[] = [];
  for (const grant of grants) {
    const groupId = previousGroupIds.includes(grant.groupId)
      ? replacements.get(grant.groupId)
      : grant.groupId;
    const subject =
      grant.type === "group" && previousGroupIds.includes(grant.subject)
        ? replacements.get(grant.subject)
        : grant.subject;
    if (!groupId || !subject) {
      continue;
    }
    let groupLabel: string;
    let subjectLabel: string;
    try {
      groupLabel =
        settings.find((item) => item.groupId === groupId)?.label ??
        (await keycloak.group(groupId)).name;
      subjectLabel =
        grant.type === "user"
          ? (await keycloak.user(subject)).username
          : (settings.find((item) => item.groupId === subject)?.label ??
            (await keycloak.group(subject)).path);
    } catch (error) {
      // Deleted recipients remain in the revocation list but cannot receive a new grant.
      if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
        throw error;
      }

      continue;
    }
    transfers.push({
      key: JSON.stringify([grant.groupId, grant.type, grant.subject]),
      to: { groupId, type: grant.type, subject },
      groupLabel,
      subjectLabel,
    });
  }

  return {
    preview: {
      previous: previous ? { id: previous.id, label: previous.label } : null,
      next: { id: next.id, label: next.label },
      activeGroups: active.groups,
      removeGroupIds: active.groups
        .filter((group) => previousGroupIds.includes(group.id))
        .map((group) => group.id),
      addGroup: { id: nextRoot.id, path: nextRoot.path },
      invitationCount,
      revokedDelegationCount: grants.length,
      transfers: transfers.map(({ key, groupLabel, subjectLabel }) => ({
        key,
        groupLabel,
        subjectLabel,
      })),
      blockedBy,
      pending: next.activation !== null,
      selectedDelegations:
        next.activation?.selectedDelegations.filter((key) =>
          transfers.some((transfer) => transfer.key === key),
        ) ?? [],
    },
    previousGroupIds,
    transfers,
  };
}

export async function previewActivateTerm(
  actor: Actor,
  id: string,
  previousTermId?: string,
) {
  await requireAdministrator(actor);

  const plan = await planActivation(id, previousTermId);

  return plan.preview;
}

export async function activateTerm(
  actor: Actor,
  id: string,
  input: z.infer<typeof activationInput>,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    {
      operation: "term.activate",
      target: { type: "term", id },
      detail: input,
    },
    async () => {
      // A shared ordered row lock serializes different target drafts. The committed
      // plan makes an interrupted Keycloak switch resumable before another can start.
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(terms)
          .orderBy(asc(terms.id))
          .for("update");
        const pending = rows.find((term) => term.activation);
        if (pending) {
          if (pending.id !== id) {
            throw new ApplicationError(409, "请先完成正在进行的任期切换");
          }

          return;
        }
        if (rows.find((term) => term.id === id)?.status === "current") {
          return;
        }
        const { preview, previousGroupIds, transfers } = await planActivation(
          id,
          input.previousTermId,
          tx,
        );
        if (preview.blockedBy.length > 0) {
          throw new ApplicationError(409, preview.blockedBy.join("；"));
        }
        if (
          input.delegations.some(
            (key) => !transfers.some((transfer) => transfer.key === key),
          )
        ) {
          throw new ApplicationError(409, "授权列表已变化，请重新预览");
        }
        const plan: TermActivationPlan = {
          previousTermId: preview.previous?.id ?? null,
          previousGroupIds,
          selectedDelegations: input.delegations,
        };
        await tx
          .update(terms)
          .set({ activation: plan })
          .where(eq(terms.id, id));
      });

      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(terms)
          .orderBy(asc(terms.id))
          .for("update");
        const target = rows.find((term) => term.id === id)!;
        // Another request may have completed this plan while this request waited.
        if (!target.activation) {
          return;
        }
        const plan = target.activation;
        await tx
          .update(managedGroups)
          .set({ allowInvites: false })
          .where(inArray(managedGroups.groupId, plan.previousGroupIds));
        const { preview, transfers } = await planActivation(
          id,
          plan.previousTermId ?? undefined,
          tx,
        );
        if (preview.blockedBy.length > 0) {
          throw new ApplicationError(409, preview.blockedBy.join("；"));
        }

        await keycloak.moveActiveRole(
          preview.removeGroupIds,
          preview.addGroup.id,
        );

        await tx
          .delete(groupDelegations)
          .where(
            or(
              inArray(groupDelegations.groupId, plan.previousGroupIds),
              and(
                eq(groupDelegations.type, "group"),
                inArray(groupDelegations.subject, plan.previousGroupIds),
              ),
            ),
          );
        const selectedTransfers = transfers.filter((transfer) =>
          plan.selectedDelegations.includes(transfer.key),
        );
        if (selectedTransfers.length > 0) {
          await tx
            .insert(groupDelegations)
            .values(
              selectedTransfers.map((transfer) => ({
                ...transfer.to,
                grantedBy: actor.subject,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .update(invitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              inArray(invitations.groupId, plan.previousGroupIds),
              isNull(invitations.revokedAt),
            ),
          );
        if (plan.previousTermId) {
          await tx
            .update(terms)
            .set({ status: "archived" })
            .where(eq(terms.id, plan.previousTermId));
        }
        await tx
          .update(terms)
          .set({ status: "current", activation: null })
          .where(eq(terms.id, id));
      });

      return { id };
    },
  );
}
