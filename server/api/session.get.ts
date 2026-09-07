import { isAdministrator } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const session = await getPortalSession(event);
  if (!session) {
    return null;
  }

  return {
    user: {
      subject: session.subject,
      username: session.username,
      displayName: session.displayName,
      email: session.email,
    },
    administrator: await isAdministrator(session),
  };
});
