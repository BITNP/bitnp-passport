import { avatarUrlFromAttributes } from "#shared/avatar";
import type { GroupNode } from "#shared/types";
import type {
  AdminProfileInput,
  AdminUserProfile,
  DirectoryUser,
} from "#shared/user";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import type {
  GroupRepresentation,
  UserRepresentation,
} from "./keycloak/shared.ts";
import { allPages, client, request } from "./keycloak/shared.ts";
import { pick } from "./utils.ts";

const fromKeycloak = (user: UserRepresentation): DirectoryUser => ({
  id: user.id!,
  username: user.username!,
  name: [user.lastName, user.firstName].join(""),
  email: user.email ?? null,
  avatarUrl: avatarUrlFromAttributes(user.attributes),
  enabled: user.enabled!,
  emailVerified: user.emailVerified!,
  createdTimestamp: user.createdTimestamp ?? null,
});

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

  return users.map(fromKeycloak);
}

export async function user(id: string) {
  const user = await request(() => client.users.findOne({ id }));

  return fromKeycloak(user!);
}

export async function userDetails(id: string) {
  const user = await request(() => client.users.findOne({ id }));
  const attributes: Record<string, string[]> = user!.attributes ?? {};
  const profile: AdminUserProfile = {
    ...fromKeycloak(user!),
    qqNumber: attributes.qq_number?.[0] ?? null,
  };

  return {
    user: profile,
    attributes,
  };
}

export async function updateUserProfile(id: string, input: AdminProfileInput) {
  const user = await request(() => client.users.findOne({ id }));

  await request(() =>
    client.users.update(
      { id },
      {
        username: user!.username,
        firstName: input.name,
        lastName: "",
        email: input.email ?? "",
        emailVerified: input.emailVerified,
        enabled: input.enabled,
        attributes: {
          ...user!.attributes,
          qq_number: input.qqNumber === null ? [] : [input.qqNumber],
        },
      },
    ),
  );

  if (!input.enabled) {
    await request(() => client.users.logout({ id }));
  }
}

export async function updateUserQqNumber(id: string, qqNumber: string | null) {
  const user = await request(() => client.users.findOne({ id }));

  await request(() =>
    client.users.update(
      { id },
      {
        ...pick(user!, [
          "username",
          "firstName",
          "lastName",
          "email",
          "enabled",
          "emailVerified",
        ]),
        attributes: {
          ...user!.attributes,
          qq_number: qqNumber === null ? [] : [qqNumber],
        },
      },
    ),
  );
}

export async function allUsers(search?: string) {
  const users = await request(() =>
    allPages((first, max) =>
      client.users.find({ search, first, max, briefRepresentation: false }),
    ),
  );

  return users.map(fromKeycloak);
}

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

  return { users: users.map(fromKeycloak), total };
}

export async function resolveUser(identifier: string) {
  const field = identifier.includes("@") ? "email" : "username";
  const [user] = await request(() =>
    client.users.find({ [field]: identifier, exact: true, max: 1 }),
  );

  if (!user) {
    throw new ApplicationError(404, `找不到用户：${identifier}`);
  }

  return fromKeycloak(user);
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

export async function inheritedGroups(
  memberships: Required<GroupRepresentation>[],
) {
  const groups = new Map(memberships.map((group) => [group.id, group]));

  for (const group of memberships) {
    let parentId: string | undefined = group.parentId;

    while (parentId && !groups.has(parentId)) {
      const parent = await request(() =>
        client.groups.findOne({ id: parentId! }),
      );
      groups.set(parentId, parent as Required<GroupRepresentation>);
      parentId = parent!.parentId;
    }
  }

  return [...groups.values()];
}

export async function group(id: string) {
  const group = await request(() => client.groups.findOne({ id }));

  return pick(group as Required<GroupRepresentation>, ["id", "name", "path"]);
}

export async function groupTree() {
  const groups = await request(() =>
    allPages((first, max) =>
      client.groups.find({ first, max, briefRepresentation: true }),
    ),
  );

  async function node(group: GroupRepresentation): Promise<GroupNode> {
    const children: GroupNode[] = [];
    if (group.subGroupCount! > 0) {
      const subGroups = await request(() =>
        allPages((first, max) =>
          client.groups.listSubGroups({
            parentId: group.id!,
            first,
            max,
            briefRepresentation: true,
          }),
        ),
      );
      for (const child of subGroups) {
        children.push(await node(child));
      }
    }

    return { id: group.id!, name: group.name!, path: group.path!, children };
  }

  const tree: GroupNode[] = [];
  for (const group of groups) {
    tree.push(await node(group));
  }

  return tree;
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

  return users.map(fromKeycloak);
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
