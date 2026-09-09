import { randomUUID } from "node:crypto";

import { asc, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { managedGroups, termGroups, terms } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator } from "./permissions.ts";
import type { termInput } from "./terms/shared.ts";
import { belongsTo, directory, termRoot } from "./terms/shared.ts";

async function validateGroups(input: z.infer<typeof termInput>) {
  const groups = directory(await keycloak.groupTree());
  const root = termRoot(groups, input.rootGroupId);
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const group of input.groups) {
    const node = groups.get(group.groupId);
    if (!node || node.id === root.id || !belongsTo(node.path, root.path)) {
      throw new ApplicationError(422, "部门群组必须位于任期根群组下");
    }
    if (ids.has(group.groupId) || codes.has(group.code)) {
      throw new ApplicationError(422, "同一任期不能重复关联群组或部门标识");
    }
    ids.add(group.groupId);
    codes.add(group.code);
  }
}

export async function listTerms(actor: Actor) {
  await requireAdministrator(actor);
  const [rows, groups, tree] = await Promise.all([
    db.query.terms.findMany({
      columns: {
        creation: false,
        activation: false,
        createdBy: false,
        createdAt: false,
      },
      with: { groups: { columns: { termId: false } } },
      extras: {
        creation: sql<boolean>`${terms.creation} is not null`.as("creating"),
        activation: sql<boolean>`${terms.activation} is not null`.as(
          "activating",
        ),
      },
      orderBy: desc(terms.createdAt),
    }),
    db
      .select({ groupId: managedGroups.groupId, label: managedGroups.label })
      .from(managedGroups)
      .orderBy(managedGroups.label),
    keycloak.groupTree(),
  ]);

  return { terms: rows, groups, directory: tree };
}

export async function saveTerm(
  actor: Actor,
  input: z.infer<typeof termInput>,
  id?: string,
) {
  await requireAdministrator(actor);
  await validateGroups(input);
  const termId = id ?? randomUUID();
  const { groups, ...settings } = input;

  return audited(
    actor,
    {
      operation: id ? "term.update" : "term.create",
      target: { type: "term", id: termId },
      detail: { after: input },
    },
    (recordBefore) =>
      db.transaction(async (tx) => {
        if (id) {
          const rows = await tx
            .select()
            .from(terms)
            .orderBy(asc(terms.id))
            .for("update");
          const term = rows.find((row) => row.id === id);
          if (term?.status !== "draft" || term.creation) {
            throw new ApplicationError(409, "只能编辑已完成群组创建的草稿任期");
          }
          if (rows.some((row) => row.activation)) {
            throw new ApplicationError(409, "请先完成正在进行的任期切换");
          }

          recordBefore({
            ...term,
            groups: await tx.query.termGroups.findMany({
              columns: { termId: false },
              where: eq(termGroups.termId, id),
            }),
          });
        } else {
          recordBefore(null);
        }

        await tx
          .insert(managedGroups)
          .values({
            groupId: input.rootGroupId,
            label: input.label,
            createdBy: actor.subject,
          })
          .onConflictDoNothing();

        if (id) {
          await tx.update(terms).set(settings).where(eq(terms.id, id));
          await tx.delete(termGroups).where(eq(termGroups.termId, id));
        } else {
          await tx
            .insert(terms)
            .values({ id: termId, ...settings, createdBy: actor.subject });
        }
        await tx
          .insert(termGroups)
          .values(groups.map((group) => ({ ...group, termId })));

        return { id: termId };
      }),
  );
}
