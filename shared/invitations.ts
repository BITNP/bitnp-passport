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

type InvitationStatus = "active" | "expired" | "revoked";

export function invitationStatus(
  invitation: {
    expiresAt: Date | string;
    revokedAt: Date | string | null;
  },
  now = Date.now(),
): InvitationStatus {
  if (invitation.revokedAt !== null) {
    return "revoked";
  }

  return new Date(invitation.expiresAt).getTime() <= now ? "expired" : "active";
}
