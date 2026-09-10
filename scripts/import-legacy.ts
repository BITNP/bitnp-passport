import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { z } from "zod";

import { closeDatabase, db } from "#backend/database";
import { groupTree } from "#backend/keycloak";
import { allPages, client } from "#backend/keycloak/shared";
import { logger } from "#backend/logger";
import type { AuditRecord } from "#database/schema";
import { auditEvents, groupDelegations, managedGroups } from "#database/schema";
import type { GroupNode } from "#shared/types";

const log = logger.child({ component: "legacy-import" });
const actor = "legacy-import";
const input = z.record(
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    internal_note: z.string().nullish(),
  }),
);

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "client": { type: "string" },
      "group-prefix": { type: "string", default: "/bitnp/active-" },
      "apply": { type: "boolean", default: false },
    },
  });
  if (positionals.length > 1 || !values.client) {
    throw new Error(
      "用法：pnpm config:import [group_config.json] --client <旧客户端 ID> [--group-prefix /bitnp/active-] [--apply]",
    );
  }

  const legacy = input.parse(
    JSON.parse(
      await readFile(
        positionals[0] ?? new URL("./group_config.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const [tree, clients] = await Promise.all([
    groupTree(),
    client.clients.find({ clientId: values.client }),
  ]);
  const legacyClient = clients.find((item) => item.clientId === values.client);
  if (!legacyClient) {
    throw new Error(`找不到旧客户端：${values.client}`);
  }

  const groupsById = new Map<string, GroupNode>();
  const groupsByPath = new Map<string, GroupNode>();

  function visit(groups: GroupNode[]) {
    for (const group of groups) {
      groupsById.set(group.id, group);
      groupsByPath.set(group.path, group);
      visit(group.children);
    }
  }

  visit(tree);

  const roleTargets = new Map<string, GroupNode>();
  const rolePaths = new Map<string, string>();
  const roles = await client.clients.listRoles({ id: legacyClient.id! });

  for (const role of roles) {
    if (!role.name!.startsWith("managerof-")) {
      continue;
    }

    const detail = await client.clients.findRole({
      id: legacyClient.id!,
      roleName: role.name!,
    });
    const path = detail!.attributes?.groupNS?.[0];
    if (!path) {
      throw new Error(`角色 ${role.name} 缺少 groupNS 属性`);
    }

    const group = groupsByPath.get(path);
    if (!group) {
      throw new Error(`角色 ${role.name} 的目标群组不存在：${path}`);
    }

    roleTargets.set(role.id!, group);
    rolePaths.set(role.name!, path);
  }

  const configuredPaths = new Map<string, z.infer<typeof input>[string]>();

  for (const [key, settings] of Object.entries(legacy)) {
    if (key.startsWith("@active/")) {
      continue;
    }

    const path = key.startsWith("@managerof-")
      ? rolePaths.get(key.slice(1))
      : key;
    if (!path || !groupsByPath.has(path)) {
      throw new Error(`配置未匹配到群组：${key}`);
    }

    // Explicit paths take precedence over role aliases, regardless of JSON order.
    configuredPaths.set(path, legacy[path] ?? settings);
  }

  const importedGroups = new Map<string, typeof managedGroups.$inferInsert>();
  const matchedTemplates = new Set<string>();

  for (const group of groupsById.values()) {
    const explicit = configuredPaths.get(group.path);
    let settings = explicit;
    let label = explicit?.name;

    if (group.path.startsWith(values["group-prefix"])) {
      const [year, ...parts] = group.path
        .slice(values["group-prefix"].length)
        .split("/");
      const key = `@active/${parts.join("/").replace(`${year}-`, "")}`;
      const template = legacy[key];

      if (template) {
        matchedTemplates.add(key);

        if (!legacy[group.path]) {
          settings = template;
          label = `${year} ${template.name}`;
        }
      }
    }

    if (settings) {
      importedGroups.set(group.id, {
        groupId: group.id,
        label: label!,
        note: settings.internal_note ?? "",
        allowInvites: true,
        createdBy: actor,
      });
    }
  }

  for (const key of Object.keys(legacy)) {
    if (key.startsWith("@active/") && !matchedTemplates.has(key)) {
      throw new Error(`配置未匹配到群组：${key}`);
    }
  }

  for (const group of roleTargets.values()) {
    if (!importedGroups.has(group.id)) {
      importedGroups.set(group.id, {
        groupId: group.id,
        label: group.name,
        note: "",
        allowInvites: true,
        createdBy: actor,
      });
    }
  }

  type Role = (typeof roles)[number];
  const composites = new Map<string, Role[]>();
  const delegations = new Map<string, typeof groupDelegations.$inferInsert>();

  async function readDelegations(type: "user" | "group", subject: string) {
    // Effective user mappings include inherited group roles. Read direct mappings
    // and expand composites so leaving a group also removes its delegated access.
    const mappings = await (
      type === "user" ? client.users : client.groups
    ).listRoleMappings({ id: subject });
    const pending = [
      ...(mappings.realmMappings ?? []),
      ...Object.values(mappings.clientMappings ?? {}).flatMap(
        (mapping) => mapping.mappings ?? [],
      ),
    ];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const role = pending.pop()!;
      const id = role.id!;
      if (visited.has(id)) {
        continue;
      }

      visited.add(id);
      const target = roleTargets.get(id);
      if (target) {
        delegations.set(JSON.stringify([target.id, type, subject]), {
          groupId: target.id,
          type,
          subject,
          grantedBy: actor,
        });
      }

      if (role.composite) {
        let children = composites.get(id);
        if (!children) {
          children = await client.roles.getCompositeRoles({ id });
          composites.set(id, children);
        }

        pending.push(...children);
      }
    }
  }

  const usernames = new Map<string, string>();

  if (roleTargets.size > 0) {
    log.info({ groups: groupsById.size }, "读取群组角色映射");
    for (const group of groupsById.values()) {
      await readDelegations("group", group.id);
    }

    const users = await allPages((first, max) =>
      client.users.find({ first, max, briefRepresentation: true }),
    );

    log.info({ users: users.length }, "读取用户角色映射");
    for (const user of users) {
      usernames.set(user.id!, user.username!);
      await readDelegations("user", user.id!);
    }
  }

  const groups = [...importedGroups.values()];
  const grants = [...delegations.values()];

  console.log(
    JSON.stringify(
      {
        realm: client.realmName,
        client: legacyClient.clientId,
        groups: groups.map((group) => ({
          ...group,
          path: groupsById.get(group.groupId)!.path,
        })),
        delegations: grants.map((grant) => ({
          ...grant,
          groupPath: groupsById.get(grant.groupId)!.path,
          subjectName:
            grant.type === "group"
              ? groupsById.get(grant.subject)!.path
              : usernames.get(grant.subject),
        })),
      },
      null,
      2,
    ),
  );

  if (values.apply) {
    const result = await db.transaction(async (tx) => {
      const insertedGroups =
        groups.length > 0
          ? await tx
              .insert(managedGroups)
              .values(groups)
              .onConflictDoNothing()
              .returning()
          : [];
      const insertedGrants =
        grants.length > 0
          ? await tx
              .insert(groupDelegations)
              .values(grants)
              .onConflictDoNothing()
              .returning()
          : [];
      const events: AuditRecord[] = [];
      for (const group of insertedGroups) {
        events.push({
          actorSubject: actor,
          operation: "group.configure",
          groupId: group.groupId,
          outcome: "succeeded",
          completedAt: new Date(),
          detail: {
            label: group.label,
            note: group.note,
            allowInvites: group.allowInvites,
          },
        });
      }
      for (const grant of insertedGrants) {
        events.push({
          actorSubject: actor,
          operation: "delegate.grant",
          groupId: grant.groupId,
          target: { type: grant.type, id: grant.subject },
          outcome: "succeeded",
          completedAt: new Date(),
        });
      }
      if (events.length > 0) {
        await tx.insert(auditEvents).values(events);
      }

      return {
        groups: insertedGroups.length,
        delegations: insertedGrants.length,
      };
    });

    log.info(result, "旧版配置已导入，已有记录保持不变");
  } else {
    log.info("迁移清单已生成；确认后添加 --apply 写入数据库");
  }
} catch (err) {
  log.fatal({ err }, "旧版配置导入失败");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
