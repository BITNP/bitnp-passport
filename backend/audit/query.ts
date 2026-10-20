import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  auditEvents,
  invitations,
  jobs,
  managedGroups,
} from "#database/schema";
import type { AuditOperation, AuditTarget } from "#shared/events";
import type { Actor } from "#shared/types";
import { formatDateTime } from "#shared/utils";

import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { groupAccess } from "../permissions.ts";

interface AuditFilter {
  first: number;
  groupId?: string;
  invitationId?: string;
  actor?: string;
  operation?: AuditOperation;
  outcome?: typeof auditEvents.$inferSelect.outcome;
  from?: Date;
  until?: Date;
}

interface Reference {
  id: string;
  label: string | null;
  to: string | null;
}

const targetGroups = alias(managedGroups, "target_group");

// 先按目标类型取 ID，再转换为 UUID，避免转换用户或群组的文本 ID
const targetId = (type: AuditTarget["type"]) =>
  sql<string | null>`case when ${auditEvents.target}->>'type' = ${type}
    then ${auditEvents.target}->>'id' end`;

function notFoundAsNull(error: unknown): null {
  // 历史用户、群组可以不存在
  if (error instanceof ApplicationError && error.statusCode === 404) {
    return null;
  }

  throw error;
}

async function actorCondition(identifier: string) {
  const user = await keycloak.resolveUser(identifier).catch(notFoundAsNull);

  return user ? eq(auditEvents.actorSubject, user.id) : sql`false`;
}

async function userReference(
  id: string,
  viewer: Actor,
  administrator: boolean,
): Promise<Reference> {
  const user = await keycloak.user(id).catch(notFoundAsNull);
  if (!user) {
    return { id, label: null, to: null };
  }

  const name = [user.lastName, user.firstName].join("");

  return {
    id,
    label: name ? `${name}（${user.username}）` : user.username,
    to:
      id === viewer.subject
        ? "/account"
        : administrator
          ? `/admin/users/${encodeURIComponent(id)}`
          : null,
  };
}

export async function listAudit(actor: Actor, query: AuditFilter) {
  const { administrator, groupIds } = await groupAccess(actor);
  // 普通用户只能查看自己发起或管理范围内的记录
  const visible = administrator
    ? undefined
    : or(
        eq(auditEvents.actorSubject, actor.subject),
        inArray(auditEvents.groupId, groupIds),
      );
  const filter = and(
    visible,
    query.groupId ? eq(auditEvents.groupId, query.groupId) : undefined,
    query.invitationId
      ? eq(auditEvents.target, { type: "invitation", id: query.invitationId })
      : undefined,
    query.actor ? await actorCondition(query.actor) : undefined,
    query.operation ? eq(auditEvents.operation, query.operation) : undefined,
    query.outcome ? eq(auditEvents.outcome, query.outcome) : undefined,
    query.from ? gte(auditEvents.createdAt, query.from) : undefined,
    query.until ? lte(auditEvents.createdAt, query.until) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        event: {
          id: sql`${auditEvents.id}`.mapWith(String),
          operation: auditEvents.operation,
          outcome: auditEvents.outcome,
          detail: auditEvents.detail,
          error: auditEvents.error,
          createdAt: auditEvents.createdAt,
          completedAt: auditEvents.completedAt,
        },
        actorSubject: auditEvents.actorSubject,
        groupId: auditEvents.groupId,
        target: auditEvents.target,
        jobId: auditEvents.jobId,
        jobOwner: jobs.actorSubject,
        groupLabel: managedGroups.label,
        targetGroupLabel: targetGroups.label,
        invitationNote: invitations.note,
        invitationCreatedAt: invitations.createdAt,
        invitationGroupId: invitations.groupId,
      })
      .from(auditEvents)
      .leftJoin(jobs, eq(auditEvents.jobId, jobs.id))
      .leftJoin(managedGroups, eq(auditEvents.groupId, managedGroups.groupId))
      .leftJoin(targetGroups, eq(targetGroups.groupId, targetId("group")))
      .leftJoin(
        invitations,
        eq(invitations.id, sql`${targetId("invitation")}::uuid`),
      )
      .where(filter)
      .orderBy(desc(auditEvents.id))
      .offset(query.first)
      .limit(50),
    db.$count(auditEvents, filter),
  ]);

  const userIds = new Set<string>();
  const missingGroupIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.actorSubject);
    if (row.target?.type === "user") {
      userIds.add(row.target.id);
    }
    if (row.groupId && row.groupLabel === null) {
      missingGroupIds.add(row.groupId);
    }
    if (row.target?.type === "group" && row.targetGroupLabel === null) {
      missingGroupIds.add(row.target.id);
    }
  }
  const [resolvedUsers, resolvedGroups] = await Promise.all([
    Promise.all(
      [...userIds].map((id) => userReference(id, actor, administrator)),
    ),
    Promise.all(
      [...missingGroupIds].map(async (id) => {
        const group = await keycloak.group(id).catch(notFoundAsNull);

        return { id, name: group?.name ?? null };
      }),
    ),
  ]);

  const users = new Map(resolvedUsers.map((user) => [user.id, user]));
  const groups = new Map(resolvedGroups.map((group) => [group.id, group]));

  function groupReference(id: string, label: string | null): Reference {
    const name = label ?? groups.get(id)!.name;

    return {
      id,
      label: name,
      to:
        name !== null && (administrator || groupIds.includes(id))
          ? `/groups/${encodeURIComponent(id)}`
          : null,
    };
  }

  return {
    events: rows.map((row) => {
      let target: Reference | null = null;
      if (row.target) {
        const { id } = row.target;
        switch (row.target.type) {
          case "user": {
            target = users.get(id)!;

            break;
          }
          case "group": {
            target = groupReference(id, row.targetGroupLabel);

            break;
          }
          case "invitation": {
            const canManage =
              row.invitationGroupId !== null &&
              (administrator || groupIds.includes(row.invitationGroupId));
            target = {
              id,
              label:
                canManage && row.invitationNote?.length
                  ? row.invitationNote
                  : row.invitationCreatedAt
                    ? `邀请（${formatDateTime(row.invitationCreatedAt)}）`
                    : null,
              to: canManage
                ? `/groups/${encodeURIComponent(row.invitationGroupId!)}`
                : null,
            };

            break;
          }
          default: {
            target = { id, label: id, to: null };
          }
        }
      }

      return {
        ...row.event,
        actor: users.get(row.actorSubject)!,
        target,
        group: row.groupId ? groupReference(row.groupId, row.groupLabel) : null,
        jobUrl:
          row.jobId && (administrator || row.jobOwner === actor.subject)
            ? `/jobs/${row.jobId}`
            : null,
      };
    }),
    total,
  };
}
