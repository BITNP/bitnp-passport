import type { SiteService } from "./types.ts";

export const events = {
  "site.update": { label: "修改站点设置", context: [], targets: [] },
  "group.configure": { label: "配置群组", context: ["groupId"], targets: [] },
  "group.create": { label: "创建群组", context: [], targets: [] },
  "member.add": { label: "添加成员", context: ["groupId"], targets: ["user"] },
  "member.remove": {
    label: "移除成员",
    context: ["groupId"],
    targets: ["user"],
  },
  "delegate.grant": {
    label: "授予委托权限",
    context: ["groupId"],
    targets: ["user", "group"],
  },
  "delegate.revoke": {
    label: "撤销委托权限",
    context: ["groupId"],
    targets: ["user", "group"],
  },
  "invitation.create": {
    label: "创建邀请",
    context: ["groupId"],
    targets: ["invitation"],
  },
  "invitation.update": {
    label: "修改邀请备注",
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
  "admin.grant": { label: "授予管理员", context: [], targets: ["user"] },
  "admin.revoke": { label: "撤销管理员", context: [], targets: ["user"] },
  "job.create": {
    label: "创建批量任务",
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
  "term.create": { label: "创建任期", context: [], targets: ["term"] },
  "term.update": { label: "编辑任期", context: [], targets: ["term"] },
  "term.create-from": { label: "创建下一届", context: [], targets: ["term"] },
  "term.provision": {
    label: "继续创建任期群组",
    context: [],
    targets: ["term"],
  },
  "term.activate": { label: "启用任期", context: [], targets: ["term"] },
} as const;

export type AuditOperation = keyof typeof events;

export interface AuditConfiguration {
  name?: string;
  label?: string;
  note?: string;
  allowInvites?: boolean;
  supportUrl?: string;
  services?: SiteService[];
  year?: number;
  rootGroupId?: string;
  clinicCompatible?: boolean;
  groups?: { groupId: string; code: string; departmentName: string }[];
}

export type AuditDetail = Record<string, unknown> & {
  before?: AuditConfiguration | null;
  after?: AuditConfiguration;
};

export type AuditEvent = {
  [Operation in AuditOperation]: {
    operation: Operation;
    detail?: AuditDetail;
  } & Record<(typeof events)[Operation]["context"][number], string> &
    ((typeof events)[Operation]["targets"][number] extends never
      ? { target?: never }
      : {
          target: {
            type: (typeof events)[Operation]["targets"][number];
            id: string;
          };
        });
}[AuditOperation];

export type AuditTarget = NonNullable<AuditEvent["target"]>;
