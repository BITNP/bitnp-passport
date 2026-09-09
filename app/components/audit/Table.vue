<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NButton, NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { AuditReference, NuxtLink } from "#components";
import { events } from "#shared/events";
import { auditOutcomeLabels } from "#shared/labels";
import { formatDateTime } from "#shared/utils";

type AuditEvent = InternalApi["/api/audit"]["get"]["events"][number];

const { records, groups } = defineProps<{
  records?: AuditEvent[];
  groups: { groupId: string; label: string }[];
  loading?: boolean;
}>();

const selectedId = ref<string>();
const selected = computed(() =>
  records?.find((event) => event.id === selectedId.value),
);

const columns: DataTableColumns<AuditEvent> = [
  {
    title: "时间",
    key: "createdAt",
    width: 185,
    render: (event) => formatDateTime(event.createdAt),
  },
  {
    title: "操作者",
    key: "actor",
    minWidth: 160,
    render: (event) => h(AuditReference, { reference: event.actor }),
  },
  {
    title: "操作",
    key: "operation",
    minWidth: 150,
    render: (event) => {
      const label = events[event.operation].label;
      if (event.jobUrl) {
        return h(NuxtLink, { to: event.jobUrl }, () => label);
      }

      return label;
    },
  },
  {
    title: "目标",
    key: "target",
    minWidth: 160,
    render: (event) => h(AuditReference, { reference: event.target }),
  },
  {
    title: "群组",
    key: "group",
    minWidth: 140,
    render: (event) => h(AuditReference, { reference: event.group }),
  },
  {
    title: "结果",
    key: "outcome",
    width: 115,
    render: (event) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type:
            event.outcome === "succeeded"
              ? "success"
              : event.outcome === "failed"
                ? "error"
                : event.outcome === "unknown"
                  ? "warning"
                  : "default",
        },
        () => auditOutcomeLabels[event.outcome],
      ),
  },
  {
    title: "详情",
    key: "details",
    width: 80,
    render: (event) =>
      h(
        NButton,
        {
          size: "small",
          onClick: () => {
            selectedId.value = event.id;
          },
        },
        () => "查看",
      ),
  },
];
</script>

<template>
  <NDataTable
    v-if="records"
    :bordered="false"
    :columns
    :data="records"
    :loading
    :row-key="(event) => event.id"
    :scroll-x="990"
  />
  <NDrawer
    :show="Boolean(selected)"
    width="min(760px, 100vw)"
    @update:show="selectedId = undefined"
  >
    <AuditDetail v-if="selected" :event="selected" :groups />
  </NDrawer>
</template>
