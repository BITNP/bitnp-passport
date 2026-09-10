import { managedGroups } from "#database/schema";
import type { GroupNode } from "#shared/types";

import { db } from "../database.ts";
import * as keycloak from "../keycloak.ts";

export async function groupDirectory() {
  const [tree, settings, terms] = await Promise.all([
    keycloak.groupTree(),
    db.select().from(managedGroups),
    db.query.terms.findMany({
      columns: { rootGroupId: true, year: true },
      with: { groups: { columns: { groupId: true } } },
    }),
  ]);
  const termYears = new Map<string, number>();
  for (const term of terms) {
    if (term.rootGroupId) {
      termYears.set(term.rootGroupId, term.year);
    }
    for (const group of term.groups) {
      termYears.set(group.groupId, term.year);
    }
  }
  const configurations = new Map(
    settings.map((group) => [group.groupId, group]),
  );
  const directory = new Map<
    string,
    GroupNode & {
      configured: boolean;
      createdAt: Date | null;
      termYear: number | null;
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
        createdAt: settings?.createdAt ?? null,
        termYear: termYears.get(group.id) ?? null,
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
