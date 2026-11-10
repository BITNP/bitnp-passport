import type { Department } from "#shared/identity";
import { activeOrganizationRole, departmentCodes } from "#shared/identity";
import type { GroupNode } from "#shared/types";

import { roleGroups } from "./keycloak/roles.ts";

type OrganizationRoot = GroupNode & {
  year: number;
  department: null;
  rootId: string;
  isRoot: true;
};

type OrganizationBranch = GroupNode & {
  year: number | null;
  department: Department | null;
  rootId: string | null;
  isRoot: false;
};

export type OrganizationGroup = OrganizationRoot | OrganizationBranch;

const rootPath = /^\/bitnp\/active-(\d{4})$/;

export function mapOrganizationGroups(tree: GroupNode[]) {
  const groups = new Map<string, OrganizationGroup>();

  function visit(nodes: GroupNode[], parent?: OrganizationGroup) {
    for (const node of nodes) {
      const rootMatch = rootPath.exec(node.path);
      const group: OrganizationGroup = rootMatch
        ? {
            ...node,
            year: Number(rootMatch[1]),
            department: null,
            rootId: node.id,
            isRoot: true,
          }
        : {
            ...node,
            year: parent?.year ?? null,
            department: parent?.isRoot
              ? (departmentCodes.find(
                  (code) => node.name === `${parent.year}-${code}`,
                ) ?? null)
              : (parent?.department ?? null),
            rootId: parent?.rootId ?? null,
            isRoot: false,
          };

      groups.set(node.id, group);
      visit(node.children, group);
    }
  }

  visit(tree);

  return groups;
}

const organizationRoots = (groups: ReadonlyMap<string, OrganizationGroup>) =>
  [...groups.values()]
    .filter((group): group is OrganizationRoot => group.isRoot)
    .sort((left, right) => right.year - left.year);

export async function organizationState(
  groups: ReadonlyMap<string, OrganizationGroup>,
) {
  const roots = organizationRoots(groups);
  const activeRoot =
    (await roleGroups(activeOrganizationRole))
      .map((group) => groups.get(group.id))
      .find((group): group is OrganizationRoot => group?.isRoot === true) ??
    null;

  return { roots, activeRoot };
}
