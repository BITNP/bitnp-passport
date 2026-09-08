import { invitationInfo } from "#backend/invitations";

export default defineEventHandler(async (event) =>
  invitationInfo(
    getRouterParam(event, "token")!,
    await getPortalSession(event),
  ),
);
