import { joinInvitation } from "#backend/invitations/access";

export default defineEventHandler(async (event) =>
  joinInvitation(await requireSession(event), getRouterParam(event, "token")!),
);
