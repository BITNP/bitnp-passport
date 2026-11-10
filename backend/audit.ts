import { eq } from "drizzle-orm";

import { auditEvents } from "#database/schema";
import type {
  AuditDetail,
  AuditEvent,
  ConfigurationAuditEvent,
  PlainAuditEvent,
} from "#shared/events";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError, errorMessage } from "./errors.ts";
import { pick } from "./utils.ts";

async function recordAudit<T>(
  actor: Actor,
  event: AuditEvent,
  run: (updateDetail: (detail: AuditDetail) => void) => Promise<T>,
) {
  let detail = event.detail ?? {};
  const inserted = await db
    .insert(auditEvents)
    .values({
      ...event,
      detail,
      actorSubject: actor.subject,
      outcome: "pending",
    })
    .returning({ id: auditEvents.id });
  const { id } = inserted[0]!;

  let result: T;

  try {
    result = await run((updated) => {
      detail = updated;
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

export const audited = <T>(
  actor: Actor,
  event: PlainAuditEvent,
  run: () => Promise<T>,
) => recordAudit(actor, event, () => run());

export function auditedConfigurationChange<T>(
  actor: Actor,
  event: ConfigurationAuditEvent,
  run: (
    recordBefore: (before: Record<string, unknown> | null) => void,
  ) => Promise<T>,
) {
  const beforeKeys = Object.keys(event.detail.after);

  return recordAudit(actor, event, (updateDetail) =>
    run((before) =>
      updateDetail({
        ...event.detail,
        before: before === null ? null : pick(before, beforeKeys),
      }),
    ),
  );
}
