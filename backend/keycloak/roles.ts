import * as keycloak from "../keycloak.ts";
import type { GroupRepresentation } from "./shared.ts";
import { client, request } from "./shared.ts";

export type Role = Awaited<
  ReturnType<typeof client.users.listRealmRoleMappings>
>[number];

export interface RoleChange {
  groupId: string | null;
  role: string;
  assigned: boolean;
}

export class RoleGraph {
  private children = new Map<string, Promise<Role[]>>();

  public async expand(assigned: Role[]) {
    const roles = new Map<string, Role>();
    const pending = [...assigned];

    while (pending.length > 0) {
      const role = pending.pop()!;
      if (roles.has(role.id!)) {
        continue;
      }

      roles.set(role.id!, role);

      if (!role.composite) {
        continue;
      }

      let children = this.children.get(role.id!);

      if (!children) {
        children = request(() =>
          client.roles.getCompositeRoles({ id: role.id! }),
        );
        this.children.set(role.id!, children);
      }

      pending.push(...(await children));
    }

    return [...roles.values()];
  }
}

export const effectiveUserRoles = (id: string) =>
  request(() => client.users.listCompositeRealmRoleMappings({ id }));

export const directUserRoles = (id: string) =>
  request(() => client.users.listRealmRoleMappings({ id }));

export const directGroupRoles = (id: string) =>
  request(() => client.groups.listRealmRoleMappings({ id }));

export const realmRole = async (name: string) =>
  (await request(() => client.roles.findOneByName({ name })))!;

export async function setUserRole(id: string, name: string, assigned: boolean) {
  const role = await realmRole(name);
  const payload = { id, roles: [{ id: role.id!, name: role.name! }] };

  await request(() =>
    assigned
      ? client.users.addRealmRoleMappings(payload)
      : client.users.delRealmRoleMappings(payload),
  );
}

export async function setGroupRole(
  id: string,
  name: string,
  assigned: boolean,
) {
  const role = await realmRole(name);
  const payload = { id, roles: [{ id: role.id!, name: role.name! }] };

  await request(() =>
    assigned
      ? client.groups.addRealmRoleMappings(payload)
      : client.groups.delRealmRoleMappings(payload),
  );
}

export async function userRoleAssignments(id: string, graph = new RoleGraph()) {
  const memberships = await keycloak.groupsForUser(id);
  const inherited = await keycloak.inheritedGroups(memberships);
  const origins = await Promise.all(
    [null, ...inherited].map(async (group) => ({
      group,
      mappings: await request(() =>
        group === null
          ? client.users.listRoleMappings({ id })
          : client.groups.listRoleMappings({ id: group.id }),
      ),
    })),
  );
  const sources: {
    group: Required<GroupRepresentation> | null;
    role: string;
    roles: string[];
  }[] = [];
  const effective = new Map<string, Role>();

  for (const { group, mappings } of origins) {
    const assignments = [
      ...(mappings.realmMappings ?? []).map((role) => ({
        role,
        name: role.name!,
      })),
      ...Object.entries(mappings.clientMappings ?? {}).flatMap(
        ([name, mapping]) =>
          ((mapping.mappings ?? []) as Role[]).map((role) => ({
            role,
            name: `${name}: ${role.name}`,
          })),
      ),
    ];

    for (const { role, name } of assignments) {
      const expanded = (await graph.expand([role])).filter(
        (child) => !child.clientRole,
      );

      for (const child of expanded) {
        effective.set(child.id!, child);
      }

      sources.push({
        group,
        role: name,
        roles: expanded.map((child) => child.name!),
      });
    }
  }

  return {
    memberships,
    inheritedGroups: new Map(inherited.map((group) => [group.id, group])),
    directRoles: origins[0]!.mappings.realmMappings ?? [],
    effectiveRoles: [...effective.values()],
    sources,
  };
}

export async function projectRoleSources(
  sources: Awaited<ReturnType<typeof userRoleAssignments>>["sources"],
  inheritedGroups: Map<string, Required<GroupRepresentation>>,
  changes: RoleChange[],
  graph: RoleGraph,
) {
  let result = [...sources];

  for (const change of changes) {
    if (change.groupId !== null && !inheritedGroups.has(change.groupId)) {
      continue;
    }

    result = result.filter(
      (source) =>
        (source.group?.id ?? null) !== change.groupId ||
        source.role !== change.role,
    );

    if (change.assigned) {
      const expanded = await graph.expand([await realmRole(change.role)]);
      result.push({
        group:
          change.groupId === null ? null : inheritedGroups.get(change.groupId)!,
        role: change.role,
        roles: expanded
          .filter((role) => !role.clientRole)
          .map((role) => role.name!),
      });
    }
  }

  return result;
}

export async function effectiveRoleHolders(name: string) {
  const users = await keycloak.allUsers();
  const holders: typeof users = [];

  for (const user of users) {
    const roles = await effectiveUserRoles(user.id!);

    if (roles.some((role) => role.name === name)) {
      holders.push(user);
    }
  }

  return holders;
}
