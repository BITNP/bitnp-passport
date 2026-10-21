import { isAdministrator } from "#backend/permissions";
import { pick } from "#backend/utils";

export default defineEventHandler(async (event) => {
  const session = await getPortalSession(event);
  if (!session) {
    return null;
  }

  return {
    user: pick(session, [
      "subject",
      "username",
      "displayName",
      "email",
      "avatarUrl",
    ]),
    administrator: await isAdministrator(session),
  };
});
