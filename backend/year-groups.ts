import { managedGroups } from "#database/schema";
import { departmentCodes, supportGroupNames } from "#shared/identity";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db, withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
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
        );
        if (!parent) {
          throw new ApplicationError(409, "Keycloak 缺少 /bitnp 根组");
        }

        const name = `active-${year}`;
        const existing = parent.children.find((group) => group.name === name);
        const id =
          existing?.id ?? (await keycloak.createGroup(name, parent.id));

        const groups = [{ id, name }];

        for (const suffix of [...departmentCodes, ...supportGroupNames]) {
          const childName = `${year}-${suffix}`;
          const group = existing?.children.find(
            (candidate) => candidate.name === childName,
          );

          groups.push({
            id: group?.id ?? (await keycloak.createGroup(childName, id)),
            name: childName,
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
