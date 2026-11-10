import { avatarUrlFromAttributes } from "#shared/avatar";
import type { GroupNode } from "#shared/types";
import type {
  AdminProfileInput,
  AdminUserProfile,
  DirectoryUser,
} from "#shared/user";
import { keycloakDisplayName } from "#shared/user";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import type {
  Group,
  KeycloakGroup,
  KeycloakUser,
  UserRepresentation,
} from "./keycloak/shared.ts";
import {
  allPages,
  asGroup,
  asKeycloakUser,
  client,
  request,
} from "./keycloak/shared.ts";
import { pick } from "./utils.ts";

const directoryUser = (user: KeycloakUser): DirectoryUser => ({
  id: user.id,
  username: user.username,
  name: keycloakDisplayName(user),
  email: user.email ?? null,
  avatarUrl: avatarUrlFromAttributes(user.attributes),
  enabled: user.enabled,
  emailVerified: user.emailVerified,
  serviceAccount: Boolean(user.serviceAccountClientId),
  createdTimestamp: user.createdTimestamp ?? null,
});

const directoryUsers = (users: UserRepresentation[]) =>
  users.map((user) => directoryUser(asKeycloakUser(user)));

async function findUser(id: string) {
  const user = await request(() => client.users.findOne({ id }));

  if (!user) {
    throw new ApplicationError(404, "用户不存在");
  }

  return asKeycloakUser(user);
}

async function findGroup(id: string) {
  const group = await request(() => client.groups.findOne({ id }));

  if (!group) {
    throw new ApplicationError(404, "群组不存在");
  }

  return asGroup(group);
}

export const consoleUrl = new URL(
  `../../admin/${encodeURIComponent(client.realmName)}/console/`,
  `${config.issuer}/`,
).href;

export function userConsoleUrl(
  id: string,
  page: "settings" | "groups" | "sessions" | "role-mapping" = "settings",
) {
  const url = new URL(consoleUrl);
  url.hash = `/${encodeURIComponent(client.realmName)}/users/${encodeURIComponent(id)}/${page}`;

  return url.href;
}

export async function directRoleHolders(name: string) {
  const users = await request(() =>
    allPages((first, max) =>
      client.roles.findUsersWithRole({
        name,
        first,
        max,
        briefRepresentation: false,
      }),
    ),
  );

  return directoryUsers(users);
}

export const user = async (id: string) => directoryUser(await findUser(id));

export async function userDetails(id: string) {
  const user = await findUser(id);
  const attributes: Record<string, string[]> = user.attributes ?? {};
  const profile: AdminUserProfile = {
    ...directoryUser(user),
    qqNumber: attributes.qq_number?.[0] ?? null,
  };

  return {
    user: profile,
    attributes,
  };
}

const userRepresentation = (
  user: KeycloakUser,
  attributes: Record<string, string[]>,
) => ({
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  emailVerified: user.emailVerified,
  enabled: user.enabled,
  attributes,
});

export async function updateUserProfile(id: string, input: AdminProfileInput) {
  const user = await findUser(id);

  await request(() =>
    client.users.update(
      { id },
      {
        ...userRepresentation(user, user.attributes ?? {}),
        firstName: input.name,
        lastName: "",
        email: input.email ?? "",
        emailVerified: input.emailVerified,
        enabled: input.enabled,
      },
    ),
  );

  return directoryUser({
    ...user,
    firstName: input.name,
    lastName: "",
    email: input.email ?? "",
    emailVerified: input.emailVerified,
    enabled: input.enabled,
  });
}

export async function updateUserQqNumber(id: string, qqNumber: string | null) {
  const user = await findUser(id);
  const attributes = {
    ...user.attributes,
    qq_number: qqNumber === null ? [] : [qqNumber],
  };

  await request(() =>
    client.users.update({ id }, userRepresentation(user, attributes)),
  );
}

export const logoutUser = (id: string) =>
  request(() => client.users.logout({ id }));

export async function searchUsers(search: string, first: number) {
  const [users, total] = await request(() =>
    Promise.all([
      client.users.find({
        search,
        first,
        max: 50,
        briefRepresentation: false,
      }),
      client.users.count({ search }),
    ]),
  );

  return { users: directoryUsers(users), total };
}

export async function resolveUser(identifier: string) {
  const usernameMatches = await request(() =>
    client.users.find({
      username: identifier,
      exact: true,
      max: 1,
      briefRepresentation: false,
    }),
  );
  const [usernameUser] = directoryUsers(usernameMatches);

  if (usernameUser) {
    return usernameUser;
  }

  const emailMatches = await request(() =>
    client.users.find({
      email: identifier,
      exact: true,
      max: 2,
      briefRepresentation: false,
    }),
  );
  const [emailUser, ...otherEmailMatches] = directoryUsers(emailMatches);

  if (!emailUser) {
    throw new ApplicationError(404, `找不到用户：${identifier}`);
  }
  if (otherEmailMatches.length > 0) {
    throw new ApplicationError(
      409,
      `邮箱匹配到多个用户：${identifier}，请改用用户名`,
    );
  }

  return emailUser;
}

export async function groupsForUser(id: string) {
  const groups = await request(() =>
    allPages((first, max) =>
      client.users.listGroups({
        id,
        first,
        max,
        briefRepresentation: false,
      }),
    ),
  );

  return groups.map(asGroup);
}

export async function inheritedGroups(memberships: Group[]) {
  const groups = new Map(memberships.map((group) => [group.id, group]));

  for (const group of memberships) {
    let parentId: string | undefined = group.parentId;

    while (parentId && !groups.has(parentId)) {
      const id = parentId;
      const parent = await findGroup(id);
      groups.set(id, parent);
      parentId = parent.parentId;
    }
  }

  return [...groups.values()];
}

export async function group(id: string) {
  const group = await findGroup(id);

  return pick(group, ["id", "name", "path"]);
}

export async function groupTree() {
  const roots = await request(() =>
    allPages((first, max) =>
      client.groups.find({
        first,
        max,
        briefRepresentation: false,
      }),
    ),
  );

  async function node(input: KeycloakGroup): Promise<GroupNode> {
    const group = asGroup(input);
    const children = await request(() =>
      allPages((first, max) =>
        client.groups.listSubGroups({
          parentId: group.id,
          first,
          max,
          briefRepresentation: false,
        }),
      ),
    );

    return {
      id: group.id,
      name: group.name,
      path: group.path,
      children: await Promise.all(children.map(node)),
    };
  }

  return Promise.all(roots.map(node));
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
        briefRepresentation: false,
      }),
    ),
  );

  return directoryUsers(users);
}

export async function addMember(userId: string, groupId: string) {
  await request(() => client.users.addToGroup({ id: userId, groupId }));
}

export async function removeMember(userId: string, groupId: string) {
  await request(() => client.users.delFromGroup({ id: userId, groupId }));
}

export async function createGroup(name: string, parentId?: string) {
  const { id } = await request(() =>
    parentId
      ? client.groups.createChildGroup({ id: parentId }, { name })
      : client.groups.create({ name }),
  );

  return decodeURIComponent(id);
}
