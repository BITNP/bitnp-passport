import { z } from "zod";

import { groupConfiguration, setGroupEnrollment } from "#backend/groups";

const input = groupConfiguration.pick({ groupId: true }).extend({
  enrolled: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return setGroupEnrollment(actor, await readValidatedBody(event, input.parse));
});
