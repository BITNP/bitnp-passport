import { managedGroups } from "#database/schema";
import type { GroupNode } from "#shared/types";

import { db } from "../database.ts";
import * as keycloak from "../keycloak.ts";

export async function groupDirectory() {
  const [tree, settings] = await Promise.all([
    keycloak.groupTree(),
    db.select().from(managedGroups),
  ]);
  const configurations = new Map(
    settings.map((group) => [group.groupId, group]),
  );
  const directory = new Map<
    string,
    GroupNode & {
      configured: boolean;
      label: string;
      note: string;
      allowInvites: boolean;
    }
  >();

  function visit(groups: GroupNode[]) {
    for (const group of groups) {
      const settings = configurations.get(group.id);
      directory.set(group.id, {
        ...group,
        configured: settings !== undefined,
        label: settings?.label ?? group.name,
        note: settings?.note ?? "",
        allowInvites: settings?.allowInvites ?? false,
      });
      visit(group.children);
    }
  }
  visit(tree);

  return directory;
}
