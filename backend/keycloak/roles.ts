import type { DirectoryUser } from "#shared/user";

import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import type { Group, KeycloakGroup } from "./shared.ts";
import { allPages, asGroup, client, request } from "./shared.ts";

type RawRole = Awaited<
  ReturnType<typeof client.users.listRealmRoleMappings>
>[number];

type Role = RawRole & { id: string; name: string };

export type RoleExpansionCache = Map<string, Promise<Role[]>>;

const rolesFromKeycloak = (roles: RawRole[]) => roles as Role[];

export interface RoleChange {
  groupId: string | null;
  role: string;
  assigned: boolean;
}

export interface RoleSource {
  group: Pick<Group, "id" | "name" | "path"> | null;
  role: string;
  roles: string[];
}

export async function expandRoles(assigned: Role[], cache: RoleExpansionCache) {
  const roles = new Map<string, Role>();

  async function visit(role: Role) {
    if (roles.has(role.id)) {
      return;
    }

    roles.set(role.id, role);

    if (!role.composite) {
      return;
    }

    let children = cache.get(role.id);

    if (!children) {
      children = (async () => {
        const items = await request(() =>
          client.roles.getCompositeRoles({ id: role.id }),
        );

        return rolesFromKeycloak(items);
      })();
      cache.set(role.id, children);
    }

    for (const child of await children) {
      await visit(child);
    }
  }

  for (const role of assigned) {
    await visit(role);
  }

  return [...roles.values()];
}

export async function effectiveUserRoles(id: string) {
  const roles = await request(() =>
    client.users.listCompositeRealmRoleMappings({ id }),
  );

  return rolesFromKeycloak(roles);
}

async function realmRole(name: string) {
  const role = await request(() => client.roles.findOneByName({ name }));

  if (!role) {
    throw new ApplicationError(404, `角色不存在：${name}`);
  }

  return role as Role;
}

export async function setUserRole(id: string, name: string, assigned: boolean) {
  const role = await realmRole(name);
  const payload = { id, roles: [{ id: role.id, name: role.name }] };

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
  const payload = { id, roles: [{ id: role.id, name: role.name }] };

  await request(() =>
    assigned
      ? client.groups.addRealmRoleMappings(payload)
      : client.groups.delRealmRoleMappings(payload),
  );
}

export async function roleGroups(name: string) {
  const groupsWithRole = client.roles.makeRequest<
    {
      name: string;
      first: number;
      max: number;
      briefRepresentation: boolean;
    },
    KeycloakGroup[]
  >({
    method: "GET",
    path: "/roles/{name}/groups",
    urlParamKeys: ["name"],
  });

  const groups = await request(() =>
    allPages((first, max) =>
      groupsWithRole({
        name,
        first,
        max,
        briefRepresentation: false,
      }),
    ),
  );

  return groups.map(asGroup);
}

export async function userRoleAssignments(
  id: string,
  cache: RoleExpansionCache = new Map(),
) {
  const memberships = await keycloak.groupsForUser(id);
  const inherited = await keycloak.inheritedGroups(memberships);
  const [directMappings, groupOrigins] = await Promise.all([
    request(() => client.users.listRoleMappings({ id })),
    Promise.all(
      inherited.map(async (group) => ({
        group,
        mappings: await request(() =>
          client.groups.listRoleMappings({ id: group.id }),
        ),
      })),
    ),
  ]);
  const origins = [{ group: null, mappings: directMappings }, ...groupOrigins];
  const sources: RoleSource[] = [];
  const effective = new Map<string, Role>();

  for (const { group, mappings } of origins) {
    const assignments = [
      ...rolesFromKeycloak(mappings.realmMappings ?? []).map((role) => ({
        role,
        name: role.name,
      })),
      ...Object.entries(mappings.clientMappings ?? {}).flatMap(
        ([clientId, mapping]) =>
          rolesFromKeycloak(mapping.mappings ?? []).map((role) => ({
            role,
            name: `${clientId}: ${role.name}`,
          })),
      ),
    ];

    for (const { role, name } of assignments) {
      const expanded = (await expandRoles([role], cache)).filter(
        (child) => !child.clientRole,
      );

      for (const child of expanded) {
        effective.set(child.id, child);
      }

      sources.push({
        group,
        role: name,
        roles: expanded.map((child) => child.name),
      });
    }
  }

  return {
    memberships,
    inheritedGroups: new Map(inherited.map((group) => [group.id, group])),
    directRoles: rolesFromKeycloak(directMappings.realmMappings ?? []),
    effectiveRoles: [...effective.values()],
    sources,
  };
}

export async function projectRoleSources(
  sources: Awaited<ReturnType<typeof userRoleAssignments>>["sources"],
  inheritedGroups: Map<string, Group>,
  changes: RoleChange[],
  cache: RoleExpansionCache,
) {
  let result = [...sources];

  for (const change of changes) {
    const sourceGroup =
      change.groupId === null
        ? null
        : (inheritedGroups.get(change.groupId) ?? null);

    if (change.groupId !== null && !sourceGroup) {
      continue;
    }

    result = result.filter(
      (source) =>
        (source.group?.id ?? null) !== change.groupId ||
        source.role !== change.role,
    );

    if (change.assigned) {
      const expanded = await expandRoles([await realmRole(change.role)], cache);
      result.push({
        group: sourceGroup,
        role: change.role,
        roles: expanded
          .filter((role) => !role.clientRole)
          .map((role) => role.name),
      });
    }
  }

  return result;
}

async function collectGroupMembers(
  id: string,
  cache: Map<string, Promise<DirectoryUser[]>>,
): Promise<DirectoryUser[]> {
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  const members = (async () => {
    const [directMembers, children] = await Promise.all([
      keycloak.members(id),
      request(() =>
        allPages((first, max) =>
          client.groups.listSubGroups({
            parentId: id,
            first,
            max,
            briefRepresentation: true,
          }),
        ),
      ),
    ]);
    const childMembers = await Promise.all(
      children.map((child) => collectGroupMembers(child.id!, cache)),
    );
    const uniqueMembers = new Map(directMembers.map((user) => [user.id, user]));

    for (const user of childMembers.flat()) {
      uniqueMembers.set(user.id, user);
    }

    return [...uniqueMembers.values()];
  })();

  cache.set(id, members);

  return members;
}

export async function effectiveRealmRoleHolders(name: string) {
  const roles = rolesFromKeycloak(
    await request(() =>
      allPages((first, max) => client.roles.find({ first, max })),
    ),
  );
  const cache: RoleExpansionCache = new Map();
  const sourceRoles: { name: string; roles: string[] }[] = [];
  const groupMemberCache = new Map<string, Promise<DirectoryUser[]>>();

  for (const role of roles) {
    const expanded = await expandRoles([role], cache);

    if (
      !expanded.some(
        (candidate) => !candidate.clientRole && candidate.name === name,
      )
    ) {
      continue;
    }

    sourceRoles.push({
      name: role.name,
      roles: expanded
        .filter((candidate) => !candidate.clientRole)
        .map((candidate) => candidate.name),
    });
  }

  const holders = new Map<
    string,
    { user: DirectoryUser; sources: RoleSource[] }
  >();

  function assign(user: DirectoryUser, source: RoleSource) {
    const holder = holders.get(user.id) ?? { user, sources: [] };
    holder.sources.push(source);
    holders.set(user.id, holder);
  }

  for (const sourceRole of sourceRoles) {
    const [directUsers, groups] = await Promise.all([
      keycloak.directRoleHolders(sourceRole.name),
      roleGroups(sourceRole.name),
    ]);

    for (const user of directUsers) {
      assign(user, {
        group: null,
        role: sourceRole.name,
        roles: sourceRole.roles,
      });
    }

    for (const group of groups) {
      const members = await collectGroupMembers(group.id, groupMemberCache);

      for (const user of members) {
        assign(user, {
          group,
          role: sourceRole.name,
          roles: sourceRole.roles,
        });
      }
    }
  }

  return [...holders.values()];
}
