import type { Department } from "#shared/identity";
import { departmentCodes, memberRole } from "#shared/identity";
import type { GroupNode } from "#shared/types";

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
          ? (departmentCodes.find(
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

const primaryDepartment = departmentCodes[0]!;
const remainingDepartments = departmentCodes.slice(1);

/**
 * The current term is the newest root whose every department group carries
 * its `position-<department>-member` mapping. Nothing else marks it.
 *
 * Detection assumes one group per entry in `departments`; keep that map in
 * sync when departments are added or removed.
 */
export async function organizationState(
  groups: ReadonlyMap<string, OrganizationGroup>,
) {
  const roots = [...groups.values()]
    .filter((group) => group.isRoot)
    .sort((left, right) => right.year! - left.year!);

  for (const root of roots) {
    const byDepartment = new Map<Department, OrganizationGroup>();

    // `organizationGroups` already marks the root's direct department children.
    for (const child of root.children) {
      const group = groups.get(child.id);

      if (group && group.department) {
        byDepartment.set(group.department, group);
      }
    }

    if (byDepartment.size !== departmentCodes.length) {
      continue;
    }

    const mapped = async (department: Department) => {
      const group = byDepartment.get(department)!;
      const roles = await directGroupRoles(group.id);

      return roles.some((role) => role.name === memberRole(department));
    };

    // Check one department first so a term that is not active costs one
    // lookup instead of four.
    if (!(await mapped(primaryDepartment))) {
      continue;
    }

    const others = await Promise.all(remainingDepartments.map(mapped));

    if (others.every(Boolean)) {
      return { roots, activeRoot: root };
    }
  }

  return { roots, activeRoot: null };
}
