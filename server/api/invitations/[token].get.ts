import { invitationInfo } from "#backend/invitations";

export default defineEventHandler((event) =>
  invitationInfo(getRouterParam(event, "token")!),
);
