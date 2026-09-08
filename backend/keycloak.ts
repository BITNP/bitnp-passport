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

export function userConsoleUrl(
  id: string,
  page: "settings" | "groups" | "sessions" = "settings",
) {
  const url = new URL(
    `../../admin/${encodeURIComponent(client.realmName)}/console/`,
    `${config.issuer}/`,
  );
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
