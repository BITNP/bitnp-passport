<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { NuxtLink } from "#components";
import { jobStatusLabels } from "#shared/labels";
import { formatDateTime } from "#shared/utils";

type Job = InternalApi["/api/jobs"]["get"]["jobs"][number];

const { groups } = defineProps<{
  jobs: InternalApi["/api/jobs"]["get"]["jobs"];
  groups?: InternalApi["/api/groups"]["get"];
  loading: boolean;
}>();

const columns: DataTableColumns<Job> = [
  {
    title: "任务",
    key: "id",
    minWidth: 180,
    render: (job) =>
      h(NuxtLink, { to: `/jobs/${job.id}` }, () => "批量成员变更"),
  },
  {
    title: "群组",
    key: "groupLabel",
    minWidth: 160,
    render: (job) => {
      const group = groups?.find((group) => group.groupId === job.groupId);
      if (!group) {
        return job.groupLabel;
      }

      return h(
        NuxtLink,
        { to: `/groups/${encodeURIComponent(group.groupId)}` },
        () => group.label,
      );
    },
  },
  {
    title: "状态",
    key: "status",
    width: 120,
    render: (job) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type:
            job.status === "succeeded"
              ? "success"
              : job.status === "failed"
                ? "error"
                : "default",
        },
        () => jobStatusLabels[job.status],
      ),
  },
  {
    title: "创建时间",
    key: "createdAt",
    width: 210,
    render: (job) => formatDateTime(job.createdAt),
  },
];
</script>

<template>
  <NDataTable
    :bordered="false"
    :columns
    :data="jobs"
    :loading
    :row-key="(job) => job.id"
    :scroll-x="680"
  />
</template>
