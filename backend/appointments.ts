import { z } from "zod";

import {
  appointmentRoles,
  roleLabel,
  roleSourceLabel,
  systemAdministratorRole,
} from "#shared/identity";
import type { Actor } from "#shared/types";
import type { DirectoryUser } from "#shared/user";
import { userLabel } from "#shared/user";

import { availableSystemAdministrators } from "./administrators.ts";
import { audited } from "./audit.ts";
import { withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import type {
  RoleChange,
  RoleExpansionCache,
  RoleSource,
} from "./keycloak/roles.ts";
import {
  projectRoleSources,
  setUserRole,
  userRoleAssignments,
} from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator } from "./permissions.ts";

export const assignmentInput = z.strictObject({
  role: z.enum([...appointmentRoles, systemAdministratorRole]),
  assigned: z.boolean(),
  previouslyAssigned: z.boolean(),
});

type AssignmentInput = z.infer<typeof assignmentInput>;

function summarizePermissions(rows: readonly RoleSource[]) {
  const permissions = new Map<
    string,
    {
      name: string;
      label: string;
      sources: {
        groupId: string | null;
        role: string;
        label: string;
      }[];
    }
  >();

  for (const source of rows) {
    const groupId = source.group?.id ?? null;

    for (const name of source.roles) {
      if (!name.startsWith("permission-")) {
        continue;
      }

      const permission = permissions.get(name) ?? {
        name,
        label: roleLabel(name),
        sources: [],
      };

      permission.sources.push({
        groupId,
        role: source.role,
        label: roleSourceLabel(source.role, groupId),
      });
      permissions.set(name, permission);
    }
  }

  return [...permissions.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function assertUserAssignable(user: DirectoryUser) {
  if (user.serviceAccount) {
    throw new ApplicationError(
      422,
      `服务账户不能获得个人任职或系统授权：${userLabel(user)}`,
    );
  }
  if (!user.enabled) {
    throw new ApplicationError(
      422,
      `不能向已停用账户授予职务或权限：${userLabel(user)}`,
    );
  }
}

async function previewRoleChange(
  subject: string,
  changes: RoleChange[],
  cache: RoleExpansionCache,
) {
  const assignsDirectRole = changes.some(
    (change) => change.groupId === null && change.assigned,
  );
  let user: DirectoryUser;
  let assignments: Awaited<ReturnType<typeof userRoleAssignments>>;
  try {
    [user, assignments] = await Promise.all([
      keycloak.user(subject),
      userRoleAssignments(subject, cache),
    ]);
  } catch (error) {
    if (
      assignsDirectRole &&
      error instanceof ApplicationError &&
      error.statusCode === 404
    ) {
      throw new ApplicationError(422, `任职名单中的用户不存在：${subject}`, {
        cause: error,
      });
    }

    throw error;
  }

  if (assignsDirectRole) {
    assertUserAssignable(user);
  }

  const sources = assignments.sources;
  const remaining = await projectRoleSources(
    sources,
    assignments.inheritedGroups,
    changes,
    cache,
  );

  return {
    subject,
    user,
    directRoles: assignments.directRoles,
    before: summarizePermissions(sources),
    after: summarizePermissions(remaining),
  };
}

export async function previewAssignment(
  subject: string,
  input: AssignmentInput,
) {
  const preview = await previewRoleChange(
    subject,
    [{ groupId: null, role: input.role, assigned: input.assigned }],
    new Map(),
  );

  if (
    preview.directRoles.some((role) => role.name === input.role) !==
    input.previouslyAssigned
  ) {
    throw new ApplicationError(409, "此项授权已变化，请刷新后重试");
  }

  if (
    !input.assigned &&
    preview.before.some(
      (permission) => permission.name === systemAdministratorRole,
    ) &&
    !preview.after.some(
      (permission) => permission.name === systemAdministratorRole,
    )
  ) {
    const otherAdministrator = (await availableSystemAdministrators()).some(
      ({ user }) => user.id !== subject,
    );

    if (!otherAdministrator) {
      throw new ApplicationError(409, "必须保留至少一位可用的系统管理员");
    }
  }

  const { user, before, after } = preview;

  return {
    ...input,
    user,
    before,
    after,
  };
}

export async function previewRoleChanges(
  plans: { subject: string; changes: RoleChange[] }[],
) {
  const cache: RoleExpansionCache = new Map();
  const previews = [];

  for (const { subject, changes } of plans) {
    previews.push(await previewRoleChange(subject, changes, cache));
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
          label: roleSourceLabel(input.role, null),
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
