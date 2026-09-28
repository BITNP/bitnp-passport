import { z } from "zod";

const invitationFields = z.object({
  note: z.string().trim(),
  allowRegistration: z.boolean(),
});

export const createInvitationInput = invitationFields.extend({
  days: z.number().int().min(1).max(30),
});

export const updateInvitationInput = invitationFields.extend({
  id: z.uuid(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationInput>;
export type UpdateInvitationInput = z.infer<typeof updateInvitationInput>;
