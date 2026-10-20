import { z } from "zod";

import {
  appointmentRoles,
  roleLabel,
  systemAdministratorRole,
} from "#shared/identity";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import type { RoleChange } from "./keycloak/roles.ts";
import {
  RoleGraph,
  directUserRoles,
  effectiveRoleHolders,
  projectRoleSources,
  setUserRole,
  userRoleAssignments,
} from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator } from "./permissions.ts";

export const assignmentInput = z.strictObject({
  role: z
    .string()
    .refine(
      (role) =>
        appointmentRoles.includes(role) || role === systemAdministratorRole,
      "请选择有效职务或个人特殊系统授权",
    ),
  assigned: z.boolean(),
  previouslyAssigned: z.boolean(),
});

type AssignmentInput = z.infer<typeof assignmentInput>;

export async function previewAssignment(
  subject: string,
  input: AssignmentInput,
) {
  const assigned = await directUserRoles(subject);

  if (
    assigned.some((role) => role.name === input.role) !==
    input.previouslyAssigned
  ) {
    throw new ApplicationError(409, "此项授权已变化，请刷新后重试");
  }

  const [preview] = await previewRoleChanges([
    {
      subject,
      changes: [{ groupId: null, role: input.role, assigned: input.assigned }],
    },
  ]);

  if (
    !input.assigned &&
    preview!.before.some((role) => role.name === systemAdministratorRole) &&
    !preview!.after.some((role) => role.name === systemAdministratorRole)
  ) {
    const holders = await effectiveRoleHolders(systemAdministratorRole);

    if (!holders.some(({ user }) => user.id !== subject && user.enabled)) {
      throw new ApplicationError(409, "必须保留至少一位可用的系统管理员");
    }
  }

  return {
    ...preview!,
    ...input,
  };
}

export async function previewRoleChanges(
  plans: { subject: string; changes: RoleChange[] }[],
) {
  const graph = new RoleGraph();
  const previews = [];

  for (const { subject, changes } of plans) {
    const user = await keycloak.user(subject);
    const matches = await keycloak.allUsers(`"${user.username}"`);

    if (!matches.some((candidate) => candidate.id === subject)) {
      throw new ApplicationError(422, "此账户不能参与任职或个人授权");
    }

    if (
      changes.some((change) => change.groupId === null && change.assigned) &&
      !user.enabled
    ) {
      throw new ApplicationError(422, "不能向已停用账户授予职务或权限");
    }

    const assignments = await userRoleAssignments(subject, graph);
    const sources = assignments.sources;
    const remaining = await projectRoleSources(
      sources,
      assignments.inheritedGroups,
      changes,
      graph,
    );

    const summarize = (rows: typeof sources) =>
      [...new Set(rows.flatMap((source) => source.roles))]
        .filter((name) => name.startsWith("permission-"))
        .sort()
        .map((name) => ({
          name,
          label: roleLabel(name),
          sources: rows
            .filter((source) => source.roles.includes(name))
            .map((source) => ({
              groupId: source.group?.id ?? null,
              role: source.role,
              label: roleLabel(source.role),
            })),
        }));

    previews.push({
      user: { id: user.id, username: user.username, enabled: user.enabled },
      before: summarize(sources),
      after: summarize(remaining),
    });
  }

  return previews;
}

export const changeAssignment = async (
  actor: Actor,
  subject: string,
  input: AssignmentInput,
) =>
  withIdentityLock(async () => {
    await requireAdministrator(actor);

    const preview = await previewAssignment(subject, input);

    await audited(
      actor,
      {
        operation: input.assigned ? "role.grant" : "role.revoke",
        target: { type: "user", id: subject },
        detail: {
          role: input.role,
          label: roleLabel(input.role),
          permissionsBefore: preview.before,
          permissionsAfter: preview.after,
        },
      },
      () => setUserRole(subject, input.role, input.assigned),
    );

    return preview;
  });

export const appointmentHolders = () =>
  Promise.all(
    appointmentRoles.map(async (role) => ({
      role,
      label: roleLabel(role),
      users: await keycloak.directRoleHolders(role),
    })),
  );
