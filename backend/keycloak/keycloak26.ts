import type { GroupRepresentation } from "./shared.ts";
import { allPages, client } from "./shared.ts";

export const userConsolePath = (
  id: string,
  page: "settings" | "groups" | "sessions",
) =>
  `/${encodeURIComponent(client.realmName)}/users/${encodeURIComponent(id)}/${page}`;

export async function findUser(
  field: "email" | "username",
  identifier: string,
) {
  const users = await client.users.find({
    [field]: identifier,
    exact: true,
    max: 1,
  });

  return users[0];
}

export async function inheritedGroupIds(memberships: GroupRepresentation[]) {
  const ids = new Set(memberships.map((group) => group.id!));

  for (const group of memberships) {
    let parentId = group.parentId;

    while (parentId && !ids.has(parentId)) {
      const parent = await client.groups.findOne({ id: parentId });
      ids.add(parentId);
      parentId = parent!.parentId;
    }
  }

  return ids;
}

export async function groupTree() {
  const roots = await allPages((first, max) =>
    client.groups.find({ first, max, briefRepresentation: true }),
  );

  async function loadChildren(group: GroupRepresentation) {
    if (group.subGroupCount! > 0) {
      group.subGroups = await allPages((first, max) =>
        client.groups.listSubGroups({
          parentId: group.id!,
          first,
          max,
          briefRepresentation: true,
        }),
      );

      for (const child of group.subGroups) {
        await loadChildren(child);
      }
    }
  }

  for (const group of roots) {
    await loadChildren(group);
  }

  return roots;
}
