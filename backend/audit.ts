import { and, desc, eq, exists, inArray, or } from "drizzle-orm";

import { auditEvents, groupDelegations, portalAdmins } from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError, errorMessage } from "./errors.ts";

interface Event {
  operation: string;
  groupId?: string;
  target?: string;
  jobId?: string;
  detail?: Record<string, unknown>;
}

export async function listAudit(actor: Actor, first: number, groupId?: string) {
  const administrator = db
    .select({ subject: portalAdmins.subject })
    .from(portalAdmins)
    .where(eq(portalAdmins.subject, actor.subject));

  const delegatedGroups = db
    .select({ groupId: groupDelegations.groupId })
    .from(groupDelegations)
    .where(eq(groupDelegations.subject, actor.subject));

  const visible = or(
    // 用户是管理员，可以查看所有审计事件
    exists(administrator),
    // 这条审计事件是用户自己触发的
    eq(auditEvents.actorSubject, actor.subject),
    // 用户是组的委托人，可以查看该组的审计事件
    inArray(auditEvents.groupId, delegatedGroups),
  );

  const rows = await db
    .select()
    .from(auditEvents)
    .where(and(visible, groupId ? eq(auditEvents.groupId, groupId) : undefined))
    .orderBy(desc(auditEvents.id))
    .offset(first)
    .limit(50);

  return {
    events: rows.map((row) => ({ ...row, id: row.id.toString() })),
    first,
    hasMore: rows.length === 50,
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
      actorSubject: actor.subject,
      operation: event.operation,
      groupId: event.groupId,
      target: event.target,
      jobId: event.jobId,
      detail: event.detail ?? {},
      outcome: "pending",
    })
    .returning({ id: auditEvents.id });
  const id = inserted!.id;

  try {
    const result = await run();

    await db
      .update(auditEvents)
      .set({ outcome: "succeeded", completedAt: new Date() })
      .where(eq(auditEvents.id, id));

    return result;
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
}
