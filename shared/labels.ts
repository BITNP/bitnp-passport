import type { AuditConfiguration } from "./events.ts";

export const jobStatusLabels = {
  queued: "等待执行",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const jobOperationLabels = {
  add: "添加成员",
  remove: "移除成员",
};

export const itemStatusLabels = {
  pending: "等待执行",
  succeeded: "已完成",
  failed: "失败",
};

export const termStatusLabels = {
  draft: "草稿",
  current: "当前任期",
  archived: "已归档",
};

export const auditOutcomeLabels = {
  pending: "处理中",
  succeeded: "成功",
  failed: "失败",
  unknown: "结果未确认",
};

export const auditFieldLabels: Record<keyof AuditConfiguration, string> = {
  code: "部门标识",
  departmentName: "部门名称",
  name: "路径名称",
  label: "显示名称",
  note: "管理备注",
  allowInvites: "允许创建邀请",
  supportUrl: "工单地址",
  services: "服务入口",
  year: "年份",
  rootGroupId: "根群组",
  clinicCompatible: "诊所兼容",
  groups: "任期群组",
};
