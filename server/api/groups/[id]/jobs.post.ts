import { z } from "zod";

import { createMembershipJob } from "#backend/memberships";

const input = z.object({
  subjects: z.array(z.string().min(1)).min(1),
  operation: z.enum(["add", "remove"]),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { subjects, operation } = await readValidatedBody(event, input.parse);

  return createMembershipJob(
    actor,
    getRouterParam(event, "id")!,
    subjects,
    operation,
  );
});
