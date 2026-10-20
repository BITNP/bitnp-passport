import { invitationInfo } from "#backend/invitations/access";

export default defineEventHandler(async (event) =>
  invitationInfo(
    getRouterParam(event, "token")!,
    await getPortalSession(event),
  ),
);
