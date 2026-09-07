import { z } from "zod";

import { createMembershipJob } from "#backend/jobs";

const input = z.object({
  subjects: z.array(z.string().min(1).max(200)).min(1).max(200),
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
