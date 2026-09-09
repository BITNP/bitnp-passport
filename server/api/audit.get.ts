import { z } from "zod";

import { listAudit } from "#backend/audit/query";
import { auditOutcome } from "#database/schema";
import type { AuditOperation } from "#shared/events";
import { events } from "#shared/events";

const input = paginationQuery
  .extend({
    groupId: z.string().min(1).optional(),
    invitationId: z.uuid().optional(),
    actor: z.string().trim().min(1).optional(),
    operation: z.enum(Object.keys(events) as AuditOperation[]).optional(),
    outcome: z.enum(auditOutcome.enumValues).optional(),
    from: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    until: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine((value) => !value.from || !value.until || value.from <= value.until, {
    message: "开始时间不能晚于结束时间",
    path: ["until"],
  });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const query = await getValidatedQuery(event, input.parse);

  return listAudit(actor, query);
});
