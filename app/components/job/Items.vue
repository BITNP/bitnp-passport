<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { NuxtLink } from "#components";
import { itemStatusLabels, jobOperationLabels } from "#shared/labels";

type Item = InternalApi["/api/jobs/:id"]["get"]["items"][number];

defineProps<{ items: InternalApi["/api/jobs/:id"]["get"]["items"] }>();
const { data: session } = await usePortalSession();

const columns: DataTableColumns<Item> = [
  {
    title: "操作",
    key: "operation",
    width: 120,
    render: (item) => jobOperationLabels[item.operation],
  },
  {
    title: "目标 ID",
    key: "itemKey",
    minWidth: 300,
    render: (item) => {
      if (session.value?.user.subject === item.itemKey) {
        return h(
          NuxtLink,
          { to: "/account", class: "mono" },
          () => item.itemKey,
        );
      }

      if (session.value?.administrator) {
        return h(
          NuxtLink,
          {
            to: `/admin/users/${encodeURIComponent(item.itemKey)}`,
            class: "mono",
          },
          () => item.itemKey,
        );
      }

      return h("span", { class: "mono" }, item.itemKey);
    },
  },
  {
    title: "状态",
    key: "status",
    width: 110,
    render: (item) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type:
            item.status === "succeeded"
              ? "success"
              : item.status === "failed"
                ? "error"
                : "default",
        },
        () => itemStatusLabels[item.status],
      ),
  },
  {
    title: "说明",
    key: "error",
    minWidth: 200,
    render: (item) => item.error ?? " - ",
  },
];
</script>

<template>
  <NCard title="执行明细">
    <NDataTable
      :bordered="false"
      :columns
      :data="items"
      :row-key="(item) => `${item.operation}:${item.itemKey}`"
      :scroll-x="720"
    />
  </NCard>
</template>
