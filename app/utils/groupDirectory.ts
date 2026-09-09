import type { GroupNode } from "#shared/types";

export function flattenGroups(
  tree: GroupNode[],
  labels: { groupId: string; label: string }[],
) {
  const names = new Map(labels.map((group) => [group.groupId, group.label]));
  const groups: {
    groupId: string;
    name: string;
    label: string;
    path: string;
    ancestors: string[];
  }[] = [];

  function visit(nodes: GroupNode[], ancestors: string[]) {
    for (const node of nodes) {
      groups.push({
        groupId: node.id,
        name: node.name,
        label: names.get(node.id) ?? node.name,
        path: node.path,
        ancestors,
      });
      visit(node.children, [...ancestors, node.id]);
    }
  }
  visit(tree, []);

  return groups;
}
