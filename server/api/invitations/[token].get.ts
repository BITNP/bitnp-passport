import { invitationInfo } from "#backend/groups";

export default defineEventHandler((event) =>
  invitationInfo(getRouterParam(event, "token")!),
);
