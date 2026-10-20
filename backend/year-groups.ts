import { managedGroups } from "#database/schema";
import { departmentCodes } from "#shared/identity";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db, withIdentityLock } from "./database.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator } from "./permissions.ts";

export const prepareYearGroups = async (actor: Actor, year: number) =>
  withIdentityLock(async () => {
    await requireAdministrator(actor);

    return audited(
      actor,
      { operation: "organization.prepare", detail: { year } },
      async () => {
        const parent = (await keycloak.groupTree()).find(
          (group) => group.path === "/bitnp",
        )!;

        const name = `active-${year}`;
        const existing = parent.children.find((group) => group.name === name);
        const id =
          existing?.id ?? (await keycloak.createGroup(name, parent.id));

        const groups = [{ id, name }];

        for (const department of [...departmentCodes, "master", "management"]) {
          const name = `${year}-${department}`;
          const group = existing?.children.find((group) => group.name === name);

          groups.push({
            id: group?.id ?? (await keycloak.createGroup(name, id)),
            name,
          });
        }

        await db
          .insert(managedGroups)
          .values(
            groups.map((group) => ({
              groupId: group.id,
              label: group.name,
              createdBy: actor.subject,
            })),
          )
          .onConflictDoNothing();

        return { id };
      },
    );
  });
