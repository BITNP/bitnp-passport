import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  auditEvents,
  invitations,
  jobs,
  managedGroups,
  terms,
} from "#database/schema";
import type { AuditOperation, AuditTarget } from "#shared/events";
import type { Actor } from "#shared/types";

import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { groupAccess } from "../permissions.ts";

interface AuditFilter {
  first: number;
  groupId?: string;
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

const systemActors = new Map([
  ["bootstrap", "初始化脚本"],
  ["legacy-import", "旧版配置导入"],
]);
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
  if (user) {
    return eq(auditEvents.actorSubject, user.id);
  }

  return systemActors.has(identifier)
    ? eq(auditEvents.actorSubject, identifier)
    : sql`false`;
}

async function userReference(
  id: string,
  viewer: Actor,
  administrator: boolean,
): Promise<Reference> {
  const systemLabel = systemActors.get(id);
  if (systemLabel) {
    return { id, label: systemLabel, to: null };
  }

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
        termLabel: terms.label,
        invitationCreatedAt: invitations.createdAt,
        invitationGroupId: invitations.groupId,
      })
      .from(auditEvents)
      .leftJoin(jobs, eq(auditEvents.jobId, jobs.id))
      .leftJoin(managedGroups, eq(auditEvents.groupId, managedGroups.groupId))
      .leftJoin(targetGroups, eq(targetGroups.groupId, targetId("group")))
      .leftJoin(terms, eq(terms.id, sql`${targetId("term")}::uuid`))
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
  const [users, groupNames] = await Promise.all([
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

  function groupReference(id: string, label: string | null): Reference {
    const name = label ?? groupNames.find((group) => group.id === id)!.name;

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
            target = users.find((user) => user.id === id)!;

            break;
          }
          case "group": {
            target = groupReference(id, row.targetGroupLabel);

            break;
          }
          case "term": {
            target = {
              id,
              label: row.termLabel,
              to:
                row.termLabel !== null && administrator ? "/admin/terms" : null,
            };

            break;
          }
          case "invitation": {
            target = {
              id,
              label: row.invitationCreatedAt
                ? `邀请 · ${row.invitationCreatedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
                : null,
              to:
                row.invitationGroupId &&
                (administrator || groupIds.includes(row.invitationGroupId))
                  ? `/groups/${encodeURIComponent(row.invitationGroupId)}`
                  : null,
            };

            break;
          }
        }
      }

      return {
        ...row.event,
        actor: users.find((user) => user.id === row.actorSubject)!,
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
