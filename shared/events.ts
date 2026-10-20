import type { UpdateInvitationInput } from "./invitations.ts";
import type { JobResult } from "./jobs.ts";
import type { SiteService } from "./types.ts";

export const auditOperations = {
  "organization.prepare": { label: "准备新届组织", context: [], targets: [] },
  "handover.execute": {
    label: "组织与任职换届",
    context: ["groupId", "jobId"],
    targets: ["group"],
  },
  "role.grant": {
    label: "授予任职或个人特殊授权",
    context: [],
    targets: ["user"],
  },
  "role.revoke": {
    label: "撤销任职或个人特殊授权",
    context: [],
    targets: ["user"],
  },
  "site.update": { label: "修改站点设置", context: [], targets: [] },
  "group.configure": { label: "配置群组", context: ["groupId"], targets: [] },
  "group.create": { label: "创建群组", context: [], targets: [] },
  "group.enroll": { label: "纳入通行证", context: ["groupId"], targets: [] },
  "group.unenroll": {
    label: "取消纳入通行证",
    context: ["groupId"],
    targets: [],
  },
  "member.add": { label: "添加成员", context: ["groupId"], targets: ["user"] },
  "member.remove": {
    label: "移除成员",
    context: ["groupId"],
    targets: ["user"],
  },
  "invitation.create": {
    label: "创建邀请",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "invitation.update": {
    label: "修改邀请设置",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "invitation.renew": {
    label: "续期邀请",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "invitation.revoke": {
    label: "撤销邀请",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "invitation.join": {
    label: "通过邀请加入",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "job.create": {
    label: "创建后台任务",
    context: ["groupId", "jobId"],
    targets: [],
  },
  "job.retry": {
    label: "重试任务",
    context: ["groupId", "jobId"],
    targets: [],
  },
  "job.cancel": {
    label: "取消任务",
    context: ["groupId", "jobId"],
    targets: [],
  },
  "job.add": {
    label: "批量添加成员",
    context: ["groupId", "jobId"],
    targets: ["user"],
  },
  "job.remove": {
    label: "批量移除成员",
    context: ["groupId", "jobId"],
    targets: ["user"],
  },
} as const;

export type AuditOperation = keyof typeof auditOperations;

interface AuditConfigurations {
  "site.update": { supportUrl: string; services: SiteService[] };
  "group.configure":
    | { name: string }
    | { name: string; label: string; note: string; allowInvites: boolean };
  "invitation.update": Omit<UpdateInvitationInput, "id">;
}

export type AuditConfiguration = AuditConfigurations[keyof AuditConfigurations];

type ConfigurationEntry<Configuration> =
  Configuration extends AuditConfiguration
    ? {
        [Key in keyof Configuration]: [Key, Configuration[Key]];
      }[keyof Configuration]
    : never;

export type AuditConfigurationEntry = ConfigurationEntry<AuditConfiguration>;

export type AuditDetail<Operation extends AuditOperation = AuditOperation> =
  Record<string, unknown> & {
    role?: string;
    label?: string;
    permissionsBefore?: { label: string }[];
    permissionsAfter?: { label: string }[];
    results?: JobResult[];
  } & (Operation extends keyof AuditConfigurations
      ? {
          before?: Partial<AuditConfigurations[Operation]> | null;
          after?: AuditConfigurations[Operation];
        }
      : { before?: never; after?: never });

export type AuditEvent = {
  [Operation in AuditOperation]: {
    operation: Operation;
    detail?: AuditDetail<Operation>;
  } & Record<(typeof auditOperations)[Operation]["context"][number], string> &
    ((typeof auditOperations)[Operation]["targets"][number] extends never
      ? { target?: never }
      : {
          target: {
            type: (typeof auditOperations)[Operation]["targets"][number];
            id: string;
          };
        });
}[AuditOperation];

export type AuditTarget = NonNullable<AuditEvent["target"]>;
