import type { GroupRepresentation } from "./shared.ts";
import { allPages, client } from "./shared.ts";

export function userConsolePath(
  id: string,
  page: "settings" | "groups" | "sessions",
) {
  const path = `/realms/${encodeURIComponent(client.realmName)}/users/${encodeURIComponent(id)}`;

  return page === "settings" ? path : `${path}/${page}`;
}

export async function findUser(
  field: "email" | "username",
  identifier: string,
) {
  // Keycloak 9 ignores exact=true and returns substring matches.
  const candidates = await allPages((first, max) =>
    client.users.find({ [field]: identifier, first, max }),
  );
  const normalized = identifier.toLowerCase();

  return candidates.find((user) => user[field]?.toLowerCase() === normalized);
}

export const groupTree = () =>
  client.groups.find({ briefRepresentation: true });

export async function inheritedGroupIds(memberships: GroupRepresentation[]) {
  const ids = new Set(memberships.map((group) => group.id!));
  if (memberships.length === 0) {
    return ids;
  }

  // Keycloak 9 has no parentId; resolve ancestors from its group tree by ID.
  function visit(group: GroupRepresentation, ancestors: string[]) {
    if (ids.has(group.id!)) {
      for (const id of ancestors) {
        ids.add(id);
      }
    }

    if (group.subGroups) {
      for (const child of group.subGroups) {
        visit(child, [...ancestors, group.id!]);
      }
    }
  }

  for (const root of await groupTree()) {
    visit(root, []);
  }

  return ids;
}

export async function groupHasRole(id: string, name: string) {
  // Keycloak 9's effective group roles do not include parent groups.
  for (const groupId of await inheritedGroupIds([{ id }])) {
    const roles = await client.groups.listCompositeRealmRoleMappings({
      id: groupId,
    });
    if (roles.some((role) => role.name === name)) {
      return true;
    }
  }

  return false;
}

export async function findGroup(name: string, parentId?: string) {
  // Keycloak 9 embeds descendants in the parent representation.
  const siblings = parentId
    ? (await client.groups.findOne({ id: parentId }))!.subGroups!
    : await allPages((first, max) =>
        client.groups.find({ first, max, briefRepresentation: false }),
      );

  return siblings.find((group) => group.name === name);
}
