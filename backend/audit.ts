import { and, desc, eq, getTableColumns, inArray, or } from "drizzle-orm";

import { auditEvents, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError, errorMessage } from "./errors.ts";
import { groupAccess } from "./permissions.ts";

interface Event {
  operation: string;
  groupId?: string;
  target?: string;
  jobId?: string;
  detail?: Record<string, unknown>;
}

export async function listAudit(actor: Actor, first: number, groupId?: string) {
  const { administrator, groupIds } = await groupAccess(actor);
  // 管理员可以查看全部审计事件，因此不需要限制
  let visible;

  if (!administrator) {
    visible = or(
      // 用户自己触发的事件
      eq(auditEvents.actorSubject, actor.subject),
      // 直接授权或通过群组继承的管理范围
      inArray(auditEvents.groupId, groupIds),
    );
  }

  const filter = and(
    visible,
    groupId ? eq(auditEvents.groupId, groupId) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        ...getTableColumns(auditEvents),
        groupLabel: managedGroups.label,
      })
      .from(auditEvents)
      .leftJoin(managedGroups, eq(auditEvents.groupId, managedGroups.groupId))
      .where(filter)
      .orderBy(desc(auditEvents.id))
      .offset(first)
      .limit(50),
    db.$count(auditEvents, filter),
  ]);

  return {
    events: rows.map((row) => ({ ...row, id: row.id.toString() })),
    total,
  };
}

export async function audited<T>(
  actor: Actor,
  event: Event,
  run: () => Promise<T>,
) {
  const [inserted] = await db
    .insert(auditEvents)
    .values({
      ...event,
      actorSubject: actor.subject,
      outcome: "pending",
    })
    .returning({ id: auditEvents.id });
  const id = inserted!.id;

  let result: T;

  try {
    result = await run();
  } catch (error) {
    const outcome =
      error instanceof ApplicationError && error.statusCode < 500
        ? "failed"
        : "unknown";

    await db
      .update(auditEvents)
      .set({ outcome, error: errorMessage(error), completedAt: new Date() })
      .where(eq(auditEvents.id, id));

    throw error;
  }

  await db
    .update(auditEvents)
    .set({ outcome: "succeeded", completedAt: new Date() })
    .where(eq(auditEvents.id, id));

  return result;
}
