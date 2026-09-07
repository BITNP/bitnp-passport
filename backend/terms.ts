// TODO: 实现自动换届，包括成员角色切换、委托继承、旧邀请撤销和任期状态更新

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";

import { managedGroups, termGroups, terms } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { requireAdministrator } from "./permissions.ts";

export const termInput = z.object({
  label: z.string().trim().min(1),
  groupIds: z.array(z.string().min(1)).min(1),
});

export async function listTerms(actor: Actor) {
  await requireAdministrator(actor);

  const [rows, groups] = await Promise.all([
    db.query.terms.findMany({
      with: { groups: true },
      orderBy: desc(terms.createdAt),
    }),
    db.select().from(managedGroups).orderBy(managedGroups.label),
  ]);

  return { terms: rows, groups };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function validateTerm(
  tx: Transaction,
  id: string,
  input: z.infer<typeof termInput>,
) {
  const duplicate = await tx.query.terms.findFirst({
    where: and(eq(terms.label, input.label), ne(terms.id, id)),
  });
  if (duplicate) {
    throw new ApplicationError(409, "任期名称已存在");
  }

  const { groupIds } = input;
  if (new Set(groupIds).size !== groupIds.length) {
    throw new ApplicationError(422, "同一任期不能重复选择群组");
  }

  const available = await tx
    .select()
    .from(managedGroups)
    .where(inArray(managedGroups.groupId, groupIds));
  if (available.length !== groupIds.length) {
    throw new ApplicationError(422, "请先将所选群组纳入管理");
  }

  const occupied = await tx
    .select()
    .from(termGroups)
    .where(
      and(inArray(termGroups.groupId, groupIds), ne(termGroups.termId, id)),
    );
  if (occupied.length > 0) {
    throw new ApplicationError(
      409,
      "每个群组只能属于一个任期，请为新任期使用新群组",
    );
  }
}

export async function createTerm(
  actor: Actor,
  input: z.infer<typeof termInput>,
) {
  await requireAdministrator(actor);

  const id = randomUUID();

  return audited(
    actor,
    { operation: "term.create", target: id, detail: input },
    async () => {
      await db.transaction(
        async (tx) => {
          await validateTerm(tx, id, input);

          await tx
            .insert(terms)
            .values({ id, label: input.label, createdBy: actor.subject });

          await tx
            .insert(termGroups)
            .values(input.groupIds.map((groupId) => ({ groupId, termId: id })));
        },
        { isolationLevel: "serializable" },
      );

      return { id };
    },
  );
}

export async function updateTerm(
  actor: Actor,
  id: string,
  input: z.infer<typeof termInput>,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "term.update", target: id, detail: input },
    async () => {
      await db.transaction(
        async (tx) => {
          const term = await tx.query.terms.findFirst({
            where: eq(terms.id, id),
          });
          if (term?.status !== "draft") {
            throw new ApplicationError(409, "只能编辑尚未启用的任期");
          }

          await validateTerm(tx, id, input);

          await tx
            .update(terms)
            .set({ label: input.label })
            .where(eq(terms.id, id));
          await tx.delete(termGroups).where(eq(termGroups.termId, id));
          await tx
            .insert(termGroups)
            .values(input.groupIds.map((groupId) => ({ groupId, termId: id })));
        },
        { isolationLevel: "serializable" },
      );

      return { id };
    },
  );
}
