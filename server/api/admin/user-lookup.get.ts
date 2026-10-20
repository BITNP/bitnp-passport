import { z } from "zod";

import * as keycloak from "#backend/keycloak";
import { requireAdministrator } from "#backend/permissions";

const input = z.object({ identifier: z.string().trim().min(1) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  await requireAdministrator(actor);
  const { identifier } = await getValidatedQuery(event, input.parse);

  return keycloak.resolveUser(identifier);
});
