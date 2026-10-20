import { and, inArray, isNull, sql } from "drizzle-orm";

import { invitations, jobs } from "#database/schema";
import type { HandoverInput } from "#shared/handover";
import {
  departments,
  roleLabel,
  systemAdministratorRole,
} from "#shared/identity";
import type { Actor } from "#shared/types";

import { appointmentHolders, previewRoleChanges } from "./appointments.ts";
import { config } from "./config.ts";
import { db, withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { createJob } from "./jobs.ts";
import { effectiveRoleHolders } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { organizationGroups, organizationState } from "./organization.ts";
import { requireAdministrator } from "./permissions.ts";

export async function handoverStatus(actor: Actor) {
  await requireAdministrator(actor);

  const [{ roots, activeRoots }, positions] = await Promise.all([
    keycloak
      .groupTree()
      .then((tree) => organizationState(organizationGroups(tree))),
    appointmentHolders(),
  ]);

  return {
    roots: roots.sort((a, b) => b.year! - a.year!),
    activeRoots,
    appointments: positions,
  };
}

function sameUsers(left: string[], right: string[]) {
  const ids = new Set(left);

  return ids.size === right.length && right.every((id) => ids.has(id));
}

export async function previewHandover(actor: Actor, input: HandoverInput) {
  const status = await handoverStatus(actor);
  const previous = status.roots.find(
    (root) => root.id === input.previousRootId,
  );
  const next = status.roots.find((root) => root.id === input.nextRootId);

  if (!previous || !next || next.year! <= previous.year!) {
    throw new ApplicationError(422, "请选择前届和年份更晚的新届");
  }

  if (
    status.activeRoots.some(
      (group) => group.id !== previous.id && group.id !== next.id,
    )
  ) {
    throw new ApplicationError(409, "所选前届、新届与当前组织不一致");
  }

  const members = [];

  for (const [department, label] of Object.entries(departments)) {
    const before = previous.children.find(
      (group) => group.name === `${previous.year}-${department}`,
    )!;
    const after = next.children.find(
      (group) => group.name === `${next.year}-${department}`,
    )!;

    members.push({
      department,
      label,
      role: `position-${department}-member`,
      previous: before,
      next: after,
    });
  }

  const planned: { subject: string; role: string; assigned: boolean }[] = [];

  for (const item of input.appointments) {
    const actual = status.appointments
      .find((position) => position.role === item.role)!
      .users.map((user) => user.id);

    if (!sameUsers(item.current, actual)) {
      throw new ApplicationError(
        409,
        `${roleLabel(item.role)}的任职已变化，请重新核对名单`,
      );
    }

    planned.push(
      ...item.next
        .filter((id) => !actual.includes(id))
        .map((subject) => ({ subject, role: item.role, assigned: true })),
    );
    planned.push(
      ...actual
        .filter((id) => !item.next.includes(id))
        .map((subject) => ({ subject, role: item.role, assigned: false })),
    );
  }

  const groupChanges = [
    { groupId: previous.id, role: config.activeRole, assigned: false },
    { groupId: next.id, role: config.activeRole, assigned: true },
    ...members.flatMap((member) => [
      { groupId: member.previous.id, role: member.role, assigned: false },
      { groupId: member.next.id, role: member.role, assigned: true },
    ]),
  ];

  const administrators = (
    await effectiveRoleHolders(systemAdministratorRole)
  ).filter((user) => user.enabled);
  const subjects = new Set([
    ...planned.map((change) => change.subject),
    ...administrators.map((user) => user.id!),
  ]);
  const previews = await previewRoleChanges(
    [...subjects].map((subject) => ({
      subject,
      changes: [
        ...groupChanges,
        ...planned
          .filter((change) => change.subject === subject)
          .map((change) => ({ ...change, groupId: null })),
      ],
    })),
  );

  if (
    !previews.some(
      (preview) =>
        preview.user.enabled &&
        preview.after.some((role) => role.name === systemAdministratorRole),
    )
  ) {
    throw new ApplicationError(409, "换届后至少需要一位可用的系统管理员");
  }

  const projections = new Map(
    previews.map((preview) => [preview.user.id, preview]),
  );
  const changes = planned.map((change) => ({
    ...change,
    preview: projections.get(change.subject)!,
  }));
  const previousGroups = [...organizationGroups([previous]).keys()];

  const invitationCount = await db.$count(
    invitations,
    and(
      inArray(invitations.groupId, previousGroups),
      isNull(invitations.revokedAt),
    ),
  );

  return { previous, next, members, changes, previousGroups, invitationCount };
}

export const createHandoverJob = async (actor: Actor, input: HandoverInput) =>
  withIdentityLock(async () => {
    const preview = await previewHandover(actor, input);
    const active = await db.query.jobs.findFirst({
      where: and(
        sql`${jobs.data}->>'type' = 'handover'`,
        inArray(jobs.status, ["queued", "running"]),
      ),
    });

    if (active) {
      throw new ApplicationError(409, "已有未完成的换届任务");
    }

    return createJob(actor, {
      groupId: preview.next.id,
      data: {
        type: "handover",
        input,
        total: preview.changes.length + preview.members.length * 2 + 3,
      },
      items: [],
      detail: {
        kind: "handover",
        previousRootId: input.previousRootId,
        nextRootId: input.nextRootId,
      },
    });
  });
