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

export const auditOperationLabels: Record<string, string> = {
  "site.update": "修改站点设置",
  "group.configure": "配置群组",
  "group.create": "创建群组",
  "member.add": "添加成员",
  "member.remove": "移除成员",
  "delegate.grant": "授予委托权限",
  "delegate.revoke": "撤销委托权限",
  "invitation.create": "创建邀请",
  "invitation.renew": "续期邀请",
  "invitation.rotate": "替换邀请",
  "invitation.revoke": "撤销邀请",
  "invitation.join": "通过邀请加入",
  "admin.grant": "授予管理员",
  "admin.revoke": "撤销管理员",
  "admin.bootstrap": "初始化管理员",
  "job.create": "创建批量任务",
  "job.retry": "重试任务",
  "job.cancel": "取消任务",
  "job.add": "批量添加成员",
  "job.remove": "批量移除成员",
  "term.create": "创建任期",
  "term.update": "编辑任期",
  "term.create-from": "创建下一届",
  "term.provision": "继续创建任期群组",
  "term.activate": "启用任期",
};
