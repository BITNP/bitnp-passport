import type { UpdateInvitationInput } from "./invitations.ts";
import type { SiteService } from "./types.ts";

export interface AuditConfigurationFields {
  supportUrl: string;
  services: SiteService[];
  name: string;
  label: string;
  note: string;
  allowInvites: boolean;
  allowRegistration: boolean;
}

export type AuditConfigurationKey = keyof AuditConfigurationFields;

export const auditConfigurationKeys = [
  "name",
  "supportUrl",
  "services",
  "label",
  "note",
  "allowInvites",
  "allowRegistration",
] as const satisfies readonly AuditConfigurationKey[];

interface AuditConfigurations {
  "site.update": Pick<AuditConfigurationFields, "supportUrl" | "services">;
  "group.configure":
    | { name: string }
    | Pick<
        AuditConfigurationFields,
        "name" | "label" | "note" | "allowInvites"
      >;
  "invitation.update": Omit<UpdateInvitationInput, "id">;
}

export type AuditConfiguration = AuditConfigurations[keyof AuditConfigurations];

interface ConfigurationDetail<Operation extends keyof AuditConfigurations> {
  before?: Partial<AuditConfigurations[Operation]> | null;
  after: AuditConfigurations[Operation];
}

interface AuditPermissionSource {
  groupId: string | null;
  role: string;
  label: string;
}

interface AuditPermission {
  name: string;
  label: string;
  sources: AuditPermissionSource[];
}

interface RoleAssignmentDetail {
  role: string;
  label: string;
  permissionsBefore: AuditPermission[];
  permissionsAfter: AuditPermission[];
}

interface UserTarget {
  type: "user";
  id: string;
}
interface GroupTarget {
  type: "group";
  id: string;
}
interface InvitationTarget {
  type: "invitation";
  id: string;
}

export type AuditTarget = UserTarget | GroupTarget | InvitationTarget;

interface AuditEventShapes {
  "user.profile.update": {
    target: UserTarget;
    detail?: never;
  };
  "organization.prepare": {
    detail: { year: number };
    target?: never;
  };
  "handover.execute": {
    groupId: string;
    jobId: string;
    target: GroupTarget;
    detail: {
      previousRootId: string;
      nextRootId: string;
    };
  };
  "role.grant": {
    target: UserTarget;
    detail: RoleAssignmentDetail;
  };
  "role.revoke": {
    target: UserTarget;
    detail: RoleAssignmentDetail;
  };
  "site.update": {
    detail: ConfigurationDetail<"site.update">;
    target?: never;
  };
  "group.configure": {
    groupId: string;
    detail: ConfigurationDetail<"group.configure">;
    target?: never;
  };
  "group.create": {
    detail: { name: string; parentId?: string };
    target?: never;
  };
  "group.enroll": {
    groupId: string;
    detail?: never;
    target?: never;
  };
  "group.unenroll": {
    groupId: string;
    detail?: never;
    target?: never;
  };
  "member.add": {
    groupId: string;
    target: UserTarget;
    detail?: never;
  };
  "member.remove": {
    groupId: string;
    target: UserTarget;
    detail?: never;
  };
  "invitation.create": {
    groupId: string;
    target: InvitationTarget;
    detail: {
      days: number;
      note: string;
      allowRegistration: boolean;
    };
  };
  "invitation.update": {
    groupId: string;
    target: InvitationTarget;
    detail: ConfigurationDetail<"invitation.update">;
  };
  "invitation.renew": {
    groupId: string;
    target: InvitationTarget;
    detail: { days: number };
  };
  "invitation.revoke": {
    groupId: string;
    target: InvitationTarget;
    detail?: never;
  };
  "invitation.join": {
    groupId: string;
    target: InvitationTarget;
    detail?: never;
  };
  "job.create": {
    groupId: string;
    jobId: string;
    target?: never;
    detail:
      | { operation: "add" | "remove"; count: number }
      | { previousRootId: string; nextRootId: string };
  };
  "job.retry": {
    groupId: string;
    jobId: string;
    detail?: never;
    target?: never;
  };
  "job.cancel": {
    groupId: string;
    jobId: string;
    detail?: never;
    target?: never;
  };
  "job.add": {
    groupId: string;
    jobId: string;
    target: UserTarget;
    detail?: never;
  };
  "job.remove": {
    groupId: string;
    jobId: string;
    target: UserTarget;
    detail?: never;
  };
}

export type AuditOperation = keyof AuditEventShapes;

export type AuditEvent = {
  [Operation in AuditOperation]: {
    operation: Operation;
  } & AuditEventShapes[Operation];
}[AuditOperation];

export type AuditDetail<Operation extends AuditOperation = AuditOperation> =
  NonNullable<AuditEventShapes[Operation]["detail"]>;
export type StoredAuditDetail = AuditDetail | Record<string, never>;

type AuditConfigurationOperation = keyof AuditConfigurations;

export type ConfigurationAuditEvent = Extract<
  AuditEvent,
  { operation: AuditConfigurationOperation }
>;
export type PlainAuditEvent = Extract<
  AuditEvent,
  { operation: Exclude<AuditOperation, AuditConfigurationOperation> }
>;

export const auditOperations = {
  "user.profile.update": "修改用户资料",
  "organization.prepare": "准备新届组织",
  "handover.execute": "组织与任职换届",
  "role.grant": "授予任职或个人特殊授权",
  "role.revoke": "撤销任职或个人特殊授权",
  "site.update": "修改站点设置",
  "group.configure": "配置群组",
  "group.create": "创建群组",
  "group.enroll": "纳入通行证",
  "group.unenroll": "取消纳入通行证",
  "member.add": "添加成员",
  "member.remove": "移除成员",
  "invitation.create": "创建邀请",
  "invitation.update": "修改邀请设置",
  "invitation.renew": "续期邀请",
  "invitation.revoke": "撤销邀请",
  "invitation.join": "通过邀请加入",
  "job.create": "创建后台任务",
  "job.retry": "重试任务",
  "job.cancel": "取消任务",
  "job.add": "批量添加成员",
  "job.remove": "批量移除成员",
} as const satisfies Record<AuditOperation, string>;
