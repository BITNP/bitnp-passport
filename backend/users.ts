import type { Actor } from "#shared/types";

import * as keycloak from "./keycloak.ts";
import { permissionDetails, requireAdministrator } from "./permissions.ts";

export async function listUsers(actor: Actor, search: string, first: number) {
  await requireAdministrator(actor);

  return keycloak.searchUsers(search, first);
}

export async function userDetail(actor: Actor, id: string) {
  await requireAdministrator(actor);

  const [user, roles, permissions] = await Promise.all([
    keycloak.user(id),
    keycloak.userRoles(id),
    permissionDetails(id),
  ]);

  return { user, roles, permissions };
}
