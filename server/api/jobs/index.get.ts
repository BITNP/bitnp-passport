import { z } from "zod";

import { listJobs } from "#backend/jobs";

const input = paginationQuery.extend({
  groupId: z.string().min(1).optional(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { first, groupId } = await getValidatedQuery(event, input.parse);

  return listJobs(actor, first, groupId);
});
