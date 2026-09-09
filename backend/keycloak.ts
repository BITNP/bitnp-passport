import type { GroupNode } from "#shared/types";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak9 from "./keycloak/keycloak9.ts";
import * as keycloak26 from "./keycloak/keycloak26.ts";
import type {
  GroupRepresentation,
  UserRepresentation,
} from "./keycloak/shared.ts";
import { allPages, client, request } from "./keycloak/shared.ts";
import { pick } from "./utils.ts";

const userSummary = (user: UserRepresentation) =>
  pick(user as Required<UserRepresentation>, [
    "id",
    "username",
    "firstName",
    "lastName",
    "email",
    "enabled",
    "createdTimestamp",
  ]);

const adapter = config.keycloakVersion === "9" ? keycloak9 : keycloak26;

const findGroupsWithRole = client.roles.makeRequest<
  { name: string; first: number; max: number; briefRepresentation: boolean },
  GroupRepresentation[]
>({ method: "GET", path: "/roles/{name}/groups", urlParamKeys: ["name"] });

export const consoleUrl = new URL(
  `../../admin/${encodeURIComponent(client.realmName)}/console/`,
  `${config.issuer}/`,
).href;

export function userConsoleUrl(
  id: string,
  page: "settings" | "groups" | "sessions" = "settings",
) {
  const url = new URL(consoleUrl);
  url.hash = adapter.userConsolePath(id, page);

  return url.href;
}

export async function userRoles(id: string) {
  const roles = await request(() =>
    client.users.listCompositeRealmRoleMappings({ id }),
  );

  return roles.map((role) =>
    pick(role as Required<typeof role>, ["id", "name"]),
  );
}

export async function user(id: string) {
  const user = await request(() => client.users.findOne({ id }));

  return user as Required<UserRepresentation>;
}

export async function searchUsers(search: string, first: number) {
  const [users, total] = await request(() =>
    Promise.all([
      client.users.find({
        search,
        first,
        max: 50,
        briefRepresentation: true,
      }),
      client.users.count({ search }),
    ]),
  );

  return { users: users as Required<UserRepresentation>[], total };
}

export async function resolveUser(identifier: string) {
  const field = identifier.includes("@") ? "email" : "username";
  const user = await request(() => adapter.findUser(field, identifier));

  if (!user) {
    throw new ApplicationError(404, `找不到用户：${identifier}`);
  }

  return userSummary(user);
}

export async function groupsForUser(id: string) {
  const groups = await request(() =>
    allPages((first, max) =>
      client.users.listGroups({
        id,
        first,
        max,
        briefRepresentation: true,
      }),
    ),
  );

  return groups as Required<GroupRepresentation>[];
}

export async function inheritedGroupIds(id: string) {
  const memberships = await groupsForUser(id);

  return request(() => adapter.inheritedGroupIds(memberships));
}

export async function group(id: string) {
  const group = await request(() => client.groups.findOne({ id }));

  return pick(group as Required<GroupRepresentation>, ["id", "name", "path"]);
}

export async function groupTree() {
  const groups = await request(() => adapter.groupTree());

  const node = (group: GroupRepresentation): GroupNode => ({
    id: group.id!,
    name: group.name!,
    path: group.path!,
    children: group.subGroups?.map(node) ?? [],
  });

  return groups.map(node);
}

export const renameGroup = (id: string, name: string) =>
  request(() => client.groups.update({ id }, { name }));

export async function members(id: string) {
  const users = await request(() =>
    allPages((first, max) =>
      client.groups.listMembers({
        id,
        first,
        max,
        briefRepresentation: true,
      }),
    ),
  );

  return users.map(userSummary);
}

export const addMember = (userId: string, groupId: string) =>
  request(() => client.users.addToGroup({ id: userId, groupId }));

export const removeMember = (userId: string, groupId: string) =>
  request(() => client.users.delFromGroup({ id: userId, groupId }));

export async function createGroup(name: string, parentId?: string) {
  const { id } = await request(() =>
    parentId
      ? client.groups.createChildGroup({ id: parentId }, { name })
      : client.groups.create({ name }),
  );

  return decodeURIComponent(id);
}

export async function ensureTermGroup(
  termId: string,
  code: string,
  name: string,
  parentId?: string,
) {
  const existing = await request(() => adapter.findGroup(name, parentId));
  if (existing) {
    if (
      existing.attributes?.["bitnp-pass-term"]?.[0] !== termId ||
      existing.attributes?.["bitnp-pass-department"]?.[0] !== code
    ) {
      throw new ApplicationError(409, `目标群组已存在：${existing.path}`);
    }

    return existing.id!;
  }

  const group = {
    name,
    attributes: {
      "bitnp-pass-term": [termId],
      "bitnp-pass-department": [code],
    },
  };

  const { id } = await request(() =>
    parentId
      ? client.groups.createChildGroup({ id: parentId }, group)
      : client.groups.create(group),
  );

  return decodeURIComponent(id);
}

export async function activeRoleGroups() {
  const [tree, role, groups] = await Promise.all([
    groupTree(),
    request(() => client.roles.findOneByName({ name: config.activeRole })),
    request(() =>
      allPages((first, max) =>
        findGroupsWithRole({
          name: config.activeRole,
          first,
          max,
          briefRepresentation: true,
        }),
      ),
    ),
  ]);

  return {
    role: role!,
    groups: groups.map((group) => ({
      id: group.id!,
      name: group.name!,
      path: group.path!,
    })),
    tree,
  };
}

export const groupHasActiveRole = (id: string) =>
  request(() => adapter.groupHasRole(id, config.activeRole));

export async function groupActiveRoleSource(id: string, roleId: string) {
  const mappings = await request(() => client.groups.listRoleMappings({ id }));
  const roles = [
    ...(mappings.realmMappings ?? []),
    ...Object.values(mappings.clientMappings ?? {}).flatMap(
      (mapping) => mapping.mappings ?? [],
    ),
  ];
  const direct = roles.some((role) => role.id === roleId);
  // Effective mappings cannot show whether a composite would retain the role
  // after its direct mapping is removed
  const pending = roles.filter((role) => role.id !== roleId);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const role = pending.pop()!;
    if (role.id === roleId) {
      return { direct, composite: true };
    }
    if (visited.has(role.id) || !role.composite) {
      continue;
    }
    visited.add(role.id);
    pending.push(
      ...(await request(() =>
        client.roles.getCompositeRoles({ id: role.id! }),
      )),
    );
  }

  return { direct, composite: false };
}

export async function moveActiveRole(
  fromGroupIds: string[],
  toGroupId: string,
) {
  const role = await request(() =>
    client.roles.findOneByName({ name: config.activeRole }),
  );
  const roles = [{ id: role!.id!, name: role!.name! }];

  for (const id of fromGroupIds) {
    await request(() => client.groups.delRealmRoleMappings({ id, roles }));
  }

  return request(() =>
    client.groups.addRealmRoleMappings({ id: toGroupId, roles }),
  );
}
