<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { EntityReference } from "#components";
import { itemStatusLabels, itemStatusTypes } from "#shared/labels";

type Item = InternalApi["/api/jobs/:id"]["get"]["items"][number];

defineProps<{ items: InternalApi["/api/jobs/:id"]["get"]["items"] }>();

const columns: DataTableColumns<Item> = [
  {
    title: "操作",
    key: "label",
    minWidth: 180,
  },
  {
    title: "对象",
    key: "target",
    minWidth: 220,
    render: (item) => h(EntityReference, { reference: item.target }),
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
          type: itemStatusTypes[item.status],
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
      :row-key="(item) => item.key"
      :scroll-x="720"
    />
  </NCard>
</template>
