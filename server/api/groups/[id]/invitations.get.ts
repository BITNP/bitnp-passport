import { listInvitations } from "#backend/invitations";

export default defineEventHandler(async (event) =>
  listInvitations(await requireSession(event), routeParam(event, "id")),
);
