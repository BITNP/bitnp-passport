import { and, gt, inArray, isNull, sql } from "drizzle-orm";

import { invitations, jobs } from "#database/schema";
import type { HandoverInput } from "#shared/handover";
import type { AppointmentRole } from "#shared/identity";
import {
  activeOrganizationRole,
  departmentCodes,
  departments,
  memberRole,
  roleLabel,
} from "#shared/identity";
import type { Actor } from "#shared/types";

import {
  assertAvailableSystemAdministrator,
  availableSystemAdministrators,
} from "./administrators.ts";
import { appointmentHolders, previewRoleChanges } from "./appointments.ts";
import { db, withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { createJob } from "./jobs.ts";
import type { RoleChange } from "./keycloak/roles.ts";
import { roleGroups } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { mapOrganizationGroups, organizationState } from "./organization.ts";
import { requireAdministrator } from "./permissions.ts";

export async function handoverStatus(actor: Actor) {
  await requireAdministrator(actor);

  const [tree, appointments] = await Promise.all([
    keycloak.groupTree(),
    appointmentHolders(),
  ]);
  const { roots, activeRoot } = await organizationState(
    mapOrganizationGroups(tree),
  );

  return {
    roots,
    activeRoot,
    appointments,
  };
}

function sameSubjects(left: string[], right: string[]) {
  const ids = new Set(left);

  return ids.size === right.length && right.every((id) => ids.has(id));
}

export async function previewHandover(actor: Actor, input: HandoverInput) {
  const status = await handoverStatus(actor);
  const previous = status.roots.find(
    (root) => root.id === input.previousRootId,
  );
  const next = status.roots.find((root) => root.id === input.nextRootId);

  if (!previous || !next || next.year <= previous.year) {
    throw new ApplicationError(422, "请选择前届和年份更晚的新届");
  }

  if (
    status.activeRoot &&
    status.activeRoot.id !== previous.id &&
    status.activeRoot.id !== next.id
  ) {
    throw new ApplicationError(
      422,
      "前届必须是当前届；若现任标记已切换，新届应与其一致",
    );
  }

  const memberDefinitions = departmentCodes.map((department) => {
    const label = departments[department];
    const previousGroup = previous.children.find(
      (group) => group.name === `${previous.year}-${department}`,
    );
    const nextGroup = next.children.find(
      (group) => group.name === `${next.year}-${department}`,
    );

    if (!previousGroup || !nextGroup) {
      throw new ApplicationError(
        422,
        `所选组织缺少 ${previous.year}-${department} 或 ${next.year}-${department} 部门组`,
      );
    }

    return {
      department,
      label,
      role: memberRole(department),
      previous: previousGroup,
      next: nextGroup,
    };
  });
  const members = await Promise.all(
    memberDefinitions.map(async (member) => ({
      ...member,
      groupsWithRole: new Set(
        (await roleGroups(member.role)).map((group) => group.id),
      ),
    })),
  );
  const mappedGroupIds = new Set(
    members.flatMap((member) => [...member.groupsWithRole]),
  );
  const organization = mapOrganizationGroups(status.roots);
  const mappedRootIds = new Set(
    [...mappedGroupIds].flatMap((id) => {
      const rootId = organization.get(id)?.rootId;

      return rootId ? [rootId] : [];
    }),
  );

  for (const root of status.roots) {
    if (
      root.id !== previous.id &&
      root.id !== next.id &&
      mappedRootIds.has(root.id)
    ) {
      throw new ApplicationError(
        409,
        `${root.path} 仍有成员身份映射，请先完成该届的换届`,
      );
    }
  }

  const planned: {
    subject: string;
    role: AppointmentRole;
    assigned: boolean;
  }[] = [];
  const currentAppointments = new Map(
    status.appointments.map((position) => [position.role, position.users]),
  );

  for (const item of input.appointments) {
    const actual = currentAppointments.get(item.role)!.map((user) => user.id);

    if (!sameSubjects(item.current, actual)) {
      throw new ApplicationError(
        409,
        `${roleLabel(item.role)}的任职已变化，请重新核对名单`,
      );
    }

    const actualIds = new Set(actual);
    const nextIds = new Set(item.next);

    planned.push(
      ...item.next
        .filter((id) => !actualIds.has(id))
        .map((subject) => ({ subject, role: item.role, assigned: true })),
    );
    planned.push(
      ...actual
        .filter((id) => !nextIds.has(id))
        .map((subject) => ({ subject, role: item.role, assigned: false })),
    );
  }

  const groupChanges: (RoleChange & {
    groupId: string;
    label: string;
  })[] = [
    ...members.flatMap((member) => [
      ...(member.groupsWithRole.has(member.next.id)
        ? []
        : [
            {
              groupId: member.next.id,
              role: member.role,
              assigned: true,
              label: `接入新届${member.label}成员身份`,
            },
          ]),
      ...(member.groupsWithRole.has(member.previous.id)
        ? [
            {
              groupId: member.previous.id,
              role: member.role,
              assigned: false,
              label: `移除前届${member.label}成员身份`,
            },
          ]
        : []),
    ]),
    ...(status.activeRoot?.id === previous.id
      ? [
          {
            groupId: previous.id,
            role: activeOrganizationRole,
            assigned: false,
            label: "移除前届现任标记",
          },
        ]
      : []),
    ...(status.activeRoot?.id === next.id
      ? []
      : [
          {
            groupId: next.id,
            role: activeOrganizationRole,
            assigned: true,
            label: "设置新届现任标记",
          },
        ]),
  ];

  const administrators = await availableSystemAdministrators();
  const subjects = new Set([
    ...planned.map((change) => change.subject),
    ...administrators.map(({ user }) => user.id),
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

  assertAvailableSystemAdministrator(
    previews,
    "换届后至少需要一位可用的系统管理员",
  );

  const previewsBySubject = new Map(
    previews.map((preview) => [preview.subject, preview]),
  );
  const changes = planned.map((change) => {
    const preview = previewsBySubject.get(change.subject)!;

    return {
      ...change,
      preview: {
        user: preview.user,
        before: preview.before,
        after: preview.after,
      },
    };
  });
  const previousGroups = [...mapOrganizationGroups([previous]).keys()];

  const invitationCount = await db.$count(
    invitations,
    and(
      inArray(invitations.groupId, previousGroups),
      isNull(invitations.revokedAt),
      gt(invitations.expiresAt, new Date()),
    ),
  );

  return {
    previous,
    next,
    changes,
    groupChanges,
    previousGroups,
    invitationCount,
  };
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
        total: preview.changes.length + preview.groupChanges.length + 1,
      },
      items: [],
      detail: {
        previousRootId: input.previousRootId,
        nextRootId: input.nextRootId,
      },
    });
  });
