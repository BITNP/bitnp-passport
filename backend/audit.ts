import { eq } from "drizzle-orm";

import { auditEvents } from "#database/schema";
import type { AuditEvent } from "#shared/events";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError, errorMessage } from "./errors.ts";
import { pick } from "./utils.ts";

export async function audited<T>(
  actor: Actor,
  event: AuditEvent,
  run: (
    recordBefore: (before: Record<string, unknown> | null) => void,
  ) => Promise<T>,
) {
  let detail = event.detail ?? {};
  const [inserted] = await db
    .insert(auditEvents)
    .values({
      ...event,
      detail,
      actorSubject: actor.subject,
      outcome: "pending",
    })
    .returning({ id: auditEvents.id });
  const id = inserted!.id;

  let result: T;

  try {
    // 配置保存会在事务内记录旧值，要等事务提交后结束
    result = await run((before) => {
      detail = {
        ...detail,
        before:
          before === null ? null : pick(before, Object.keys(detail.after!)),
      };
    });
  } catch (error) {
    const outcome =
      error instanceof ApplicationError && error.statusCode < 500
        ? "failed"
        : "unknown";

    await db
      .update(auditEvents)
      .set({
        outcome,
        detail,
        error: errorMessage(error),
        completedAt: new Date(),
      })
      .where(eq(auditEvents.id, id));

    throw error;
  }

  await db
    .update(auditEvents)
    .set({ outcome: "succeeded", detail, completedAt: new Date() })
    .where(eq(auditEvents.id, id));

  return result;
}
