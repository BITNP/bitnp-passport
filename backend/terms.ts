// TODO: 实现自动换届，包括成员角色切换、委托继承、旧邀请撤销和任期状态更新

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
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

export async function createTerm(
  actor: Actor,
  input: z.infer<typeof termInput>,
) {
  await requireAdministrator(actor);

  const id = randomUUID();

  return audited(
    actor,
    { operation: "term.create", target: id, detail: input },
    () =>
      db.transaction(async (tx) => {
        await tx
          .insert(terms)
          .values({ id, label: input.label, createdBy: actor.subject });

        await tx
          .insert(termGroups)
          .values(input.groupIds.map((groupId) => ({ groupId, termId: id })));
      }),
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
    () =>
      db.transaction(async (tx) => {
        const [term] = await tx
          .update(terms)
          .set({ label: input.label })
          .where(and(eq(terms.id, id), eq(terms.status, "draft")))
          .returning({ id: terms.id });
        if (!term) {
          throw new ApplicationError(409, "只能编辑尚未启用的任期");
        }

        await tx.delete(termGroups).where(eq(termGroups.termId, id));
        await tx
          .insert(termGroups)
          .values(input.groupIds.map((groupId) => ({ groupId, termId: id })));
      }),
  );
}
