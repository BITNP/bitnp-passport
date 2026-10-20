import type { jobs } from "#database/schema";

type JobStatus = typeof jobs.$inferSelect.status;

export const jobPolicies = {
  membership: {
    title: "批量成员变更",
    retryable: true,
    cancelStatuses: new Set<JobStatus>(["failed", "queued", "running"]),
    failureNotice: null,
    followup: null,
  },
  handover: {
    title: "组织与任职换届",
    retryable: false,
    cancelStatuses: new Set<JobStatus>(["queued"]),
    failureNotice: "已完成的变更会保留。",
    followup: { label: "重新安排换届", to: "/admin/handover" },
  },
};
