import { z } from "zod";

import { listAudit } from "#backend/audit";

const input = paginationQuery.extend({
  groupId: z.string().min(1).optional(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { first, groupId } = await getValidatedQuery(event, input.parse);

  return listAudit(actor, first, groupId);
});
