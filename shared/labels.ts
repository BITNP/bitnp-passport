import type { AuditConfigurationKey } from "./events.ts";
import { auditOperations } from "./events.ts";

const auditOperationLabels = new Map(Object.entries(auditOperations));

export const auditOperationLabel = (operation: string) =>
  auditOperationLabels.get(operation) ?? operation;

export const jobStatusLabels = {
  queued: "等待执行",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const jobStatusTypes = {
  queued: "default",
  running: "default",
  succeeded: "success",
  failed: "error",
  cancelled: "default",
} as const;

export const jobOperationLabels = {
  add: "添加成员",
  remove: "移除成员",
};

export const itemStatusLabels = {
  pending: "待处理",
  succeeded: "已完成",
  failed: "失败",
};

export const itemStatusTypes = {
  pending: "default",
  succeeded: "success",
  failed: "error",
} as const;

export const auditOutcomeLabels = {
  pending: "处理中",
  succeeded: "成功",
  failed: "失败",
  unknown: "结果未确认",
};

export const auditOutcomeTypes = {
  pending: "default",
  succeeded: "success",
  failed: "error",
  unknown: "warning",
} as const;

export const auditFieldLabels: Record<AuditConfigurationKey, string> = {
  name: "路径名称",
  label: "显示名称",
  note: "管理备注",
  allowInvites: "允许创建邀请",
  allowRegistration: "允许通过邀请注册",
  supportUrl: "工单地址",
  services: "服务入口",
};
