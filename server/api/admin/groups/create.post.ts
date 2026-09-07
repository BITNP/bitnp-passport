import { z } from "zod";

import { createGroup } from "#backend/groups";

const input = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[^/\p{Cc}]+$/u),
  parentId: z.string().min(1).max(200).optional(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { name, parentId } = await readValidatedBody(event, input.parse);

  return createGroup(actor, name, parentId);
});
