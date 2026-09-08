import { z } from "zod";

import { createGroup, groupConfiguration } from "#backend/groups";

const input = groupConfiguration.omit({ groupId: true }).extend({
  parentId: z.string().min(1).optional(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return createGroup(actor, await readValidatedBody(event, input.parse));
});
