import { eq } from "drizzle-orm";
import { z } from "zod";

import { terms } from "#database/schema";
import type { GroupNode } from "#shared/types";

import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";

export type DatabaseReader = Pick<typeof db, "query" | "select" | "$count">;

const department = z.object({
  groupId: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^/\p{Cc}]+$/u),
  departmentName: z.string().trim().min(1),
});

export const termInput = z.object({
  label: z.string().trim().min(1),
  year: z.number().int().positive(),
  rootGroupId: z.string().min(1),
  clinicCompatible: z.boolean(),
  groups: z.array(department).min(1),
});

export function directory(tree: GroupNode[]) {
  const result = new Map<string, GroupNode>();
  function visit(nodes: GroupNode[]) {
    for (const node of nodes) {
      result.set(node.id, node);
      visit(node.children);
    }
  }
  visit(tree);

  return result;
}

export const belongsTo = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`);

export async function readCreatedTerm(
  id: string,
  connection: DatabaseReader = db,
) {
  const term = await connection.query.terms.findFirst({
    where: eq(terms.id, id),
    with: { groups: true },
  });
  if (!term) {
    throw new ApplicationError(404, "任期不存在");
  }

  if (term.creation) {
    throw new ApplicationError(409, "请先完成此任期的群组创建");
  }

  return term as typeof term & { rootGroupId: string };
}

export function termRoot(nodes: Map<string, GroupNode>, id: string) {
  const node = nodes.get(id);
  if (!node) {
    throw new ApplicationError(404, "任期根群组已不存在，请重新配置");
  }

  return node;
}
