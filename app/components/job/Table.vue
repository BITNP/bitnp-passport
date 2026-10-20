<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { EntityReference, NuxtLink } from "#components";
import { jobStatusLabels, jobStatusTypes } from "#shared/labels";
import { formatDateTime } from "#shared/utils";

type Job = InternalApi["/api/jobs"]["get"]["jobs"][number];

defineProps<{
  jobs: InternalApi["/api/jobs"]["get"]["jobs"];
  loading: boolean;
}>();

const columns: DataTableColumns<Job> = [
  {
    title: "任务",
    key: "id",
    minWidth: 180,
    render: (job) => h(NuxtLink, { to: `/jobs/${job.id}` }, () => job.title),
  },
  {
    title: "群组",
    key: "group",
    minWidth: 160,
    render: (job) => h(EntityReference, { reference: job.group }),
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
          type: jobStatusTypes[job.status],
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
