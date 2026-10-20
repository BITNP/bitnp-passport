import type { Department } from "#shared/identity";
import { departments } from "#shared/identity";
import type { GroupNode } from "#shared/types";

import { config } from "./config.ts";
import { directGroupRoles } from "./keycloak/roles.ts";

export type OrganizationGroup = GroupNode & {
  year: number | null;
  department: Department | null;
  rootId: string | null;
  isRoot: boolean;
};

export function organizationGroups(tree: GroupNode[]) {
  const groups = new Map<string, OrganizationGroup>();

  function visit(nodes: GroupNode[], parent?: OrganizationGroup) {
    for (const node of nodes) {
      const root = /^\/bitnp\/active-(\d{4})$/.exec(node.path);
      const year = root ? Number(root[1]) : (parent?.year ?? null);
      const group: OrganizationGroup = {
        ...node,
        year,
        department: parent?.isRoot
          ? ((Object.keys(departments) as Department[]).find(
              (department) => node.name === `${year}-${department}`,
            ) ?? null)
          : (parent?.department ?? null),
        rootId: root ? node.id : (parent?.rootId ?? null),
        isRoot: !!root,
      };
      groups.set(node.id, group);
      visit(node.children, group);
    }
  }

  visit(tree);

  return groups;
}

export async function organizationState(
  groups: ReadonlyMap<string, OrganizationGroup>,
) {
  const roots = [...groups.values()].filter((group) => group.isRoot);
  const activeRoots: OrganizationGroup[] = [];

  for (const root of roots) {
    const roles = await directGroupRoles(root.id);

    if (roles.some((role) => role.name === config.activeRole)) {
      activeRoots.push(root);
    }
  }

  return { roots, activeRoots };
}
