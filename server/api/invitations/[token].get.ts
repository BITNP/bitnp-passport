import { invitationInfo } from "#backend/invitations/access";

export default defineEventHandler(async (event) =>
  invitationInfo(routeParam(event, "token"), await getPortalSession(event)),
);
