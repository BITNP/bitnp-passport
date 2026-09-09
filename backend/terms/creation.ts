import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { managedGroups, termGroups, terms } from "#database/schema";
import type { Actor, TermCreationPlan } from "#shared/types";

import { audited } from "../audit.ts";
import { db } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";
import { requireAdministrator } from "../permissions.ts";
import {
  belongsTo,
  directory,
  readCreatedTerm,
  termInput,
  termRoot,
} from "./shared.ts";

export const creationInput = termInput
  .pick({ label: true, year: true, clinicCompatible: true })
  .extend({
    sourceTermId: z.uuid(),
    parentId: z.string().min(1).optional(),
  });

async function planCreation(
  input: z.infer<typeof creationInput>,
): Promise<TermCreationPlan> {
  const source = await readCreatedTerm(input.sourceTermId);
  if (input.year <= source.year) {
    throw new ApplicationError(422, "新任期年份必须晚于来源任期");
  }
  const [tree, settings] = await Promise.all([
    keycloak.groupTree(),
    db.select().from(managedGroups),
  ]);
  const nodes = directory(tree);
  const root = termRoot(nodes, source.rootGroupId);
  const parent = input.parentId ? termRoot(nodes, input.parentId) : undefined;
  if (parent && belongsTo(parent.path, root.path)) {
    throw new ApplicationError(422, "新任期不能建在旧任期的群组树内");
  }
  if (parent && (await keycloak.groupHasActiveRole(parent.id))) {
    throw new ApplicationError(
      422,
      "父群组会让草稿继承现任角色，请选择其他父群组",
    );
  }

  const name = input.clinicCompatible
    ? `active-${input.year}`
    : String(input.year);
  const path = `${parent?.path ?? ""}/${name}`;
  if ([...nodes.values()].some((group) => group.path === path)) {
    throw new ApplicationError(409, `目标群组已存在：${path}`);
  }
  const rootSettings = settings.find((group) => group.groupId === root.id)!;
  const plan: TermCreationPlan = {
    parentId: input.parentId,
    root: {
      name,
      path,
      note: rootSettings.note,
      allowInvites: rootSettings.allowInvites,
    },
    groups: [],
  };

  const departments = new Map(
    source.groups.map((group) => [group.groupId, group]),
  );
  const parents = new Map<string, { code: string | null; path: string }>([
    [root.path, { code: null, path }],
  ]);
  for (const group of nodes.values()) {
    const department = departments.get(group.id);
    if (!department || !belongsTo(group.path, root.path)) {
      continue;
    }
    const parentPath = group.path.slice(0, group.path.lastIndexOf("/"));
    const parent = parents.get(parentPath);
    if (!parent) {
      throw new ApplicationError(
        409,
        `请先为来源任期的群组补充部门信息：${parentPath}`,
      );
    }
    const configuration = settings.find((item) => item.groupId === group.id)!;
    const code = department.code;
    const name = input.clinicCompatible ? `${input.year}-${code}` : code;
    const path = `${parent.path}/${name}`;
    plan.groups.push({
      sourceGroupId: group.id,
      code,
      departmentName: department.departmentName,
      parentCode: parent.code,
      name,
      path,
      label: `${input.year} ${department.departmentName}`,
      note: configuration.note,
      allowInvites: configuration.allowInvites,
    });
    parents.set(group.path, { code, path });
  }
  if (plan.groups.length !== source.groups.length) {
    throw new ApplicationError(409, "来源群组结构已变化，请重新配置任期");
  }

  return plan;
}

export async function previewCreateTerm(
  actor: Actor,
  input: z.infer<typeof creationInput>,
) {
  await requireAdministrator(actor);

  const plan = await planCreation(input);

  return {
    root: { path: plan.root.path },
    groups: plan.groups.map(({ sourceGroupId, code, path, label }) => ({
      sourceGroupId,
      code,
      path,
      label,
    })),
  };
}

async function provision(id: string, actor: Actor) {
  await db.transaction(async (tx) => {
    // 同一任期的创建、重试和编辑共用行锁，群组全部创建成功后才提交配置
    const [term] = await tx
      .select()
      .from(terms)
      .where(eq(terms.id, id))
      .for("update");
    if (!term) {
      throw new ApplicationError(404, "任期不存在");
    }
    const plan = term.creation;
    if (!plan) {
      return;
    }

    const rootId = await keycloak.ensureTermGroup(
      id,
      "@root",
      plan.root.name,
      plan.parentId,
    );
    await tx
      .insert(managedGroups)
      .values({
        groupId: rootId,
        label: term.label,
        note: plan.root.note,
        allowInvites: plan.root.allowInvites,
        createdBy: actor.subject,
      })
      .onConflictDoNothing();
    const created = new Map<string, string>();
    for (const group of plan.groups) {
      const parentId =
        group.parentCode === null ? rootId : created.get(group.parentCode)!;
      const groupId = await keycloak.ensureTermGroup(
        id,
        group.code,
        group.name,
        parentId,
      );
      await tx
        .insert(managedGroups)
        .values({
          groupId,
          label: group.label,
          note: group.note,
          allowInvites: group.allowInvites,
          createdBy: actor.subject,
        })
        .onConflictDoNothing();
      await tx.insert(termGroups).values({
        termId: id,
        groupId,
        code: group.code,
        departmentName: group.departmentName,
      });
      created.set(group.code, groupId);
    }

    await tx
      .update(terms)
      .set({ rootGroupId: rootId, creation: null })
      .where(eq(terms.id, id));
  });

  return { id };
}

export async function createFromTerm(
  actor: Actor,
  input: z.infer<typeof creationInput>,
) {
  await requireAdministrator(actor);
  const plan = await planCreation(input);
  const id = randomUUID();

  return audited(
    actor,
    { operation: "term.create-from", target: id, detail: input },
    async () => {
      await db.insert(terms).values({
        id,
        label: input.label,
        year: input.year,
        clinicCompatible: input.clinicCompatible,
        creation: plan,
        createdBy: actor.subject,
      });

      return provision(id, actor);
    },
  );
}

export async function provisionTerm(actor: Actor, id: string) {
  await requireAdministrator(actor);

  return audited(actor, { operation: "term.provision", target: id }, () =>
    provision(id, actor),
  );
}
