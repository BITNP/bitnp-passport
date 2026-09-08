import { z } from "zod";

import { consoleUrl, userConsoleUrl } from "#backend/keycloak";
import { requireAdministrator } from "#backend/permissions";

const input = z.object({
  user: z.string().min(1).optional(),
  page: z.enum(["settings", "groups", "sessions"]).default("settings"),
});

export default defineEventHandler(async (event) => {
  await requireAdministrator(await requireSession(event));

  const { user, page } = await getValidatedQuery(event, input.parse);

  return sendRedirect(
    event,
    user ? userConsoleUrl(user, page) : consoleUrl,
    302,
  );
});
