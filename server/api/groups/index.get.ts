import { managedGroups } from "#backend/permissions";

export default defineEventHandler(async (event) =>
  managedGroups(await requireSession(event)),
);
