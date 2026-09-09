<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NText } from "naive-ui";

import type { MembershipPreview } from "#shared/types";

const { preview } = defineProps<{ preview: MembershipPreview }>();

const columns: DataTableColumns<MembershipPreview["rows"][number]> = [
  { title: "输入", key: "identifier", minWidth: 200 },
  {
    title: "匹配账户",
    key: "username",
    minWidth: 160,
    render: (row) => row.user?.username ?? " - ",
  },
  {
    title: "当前状态",
    key: "status",
    minWidth: 200,
    render: (row) =>
      row.error
        ? h(NText, { type: "error" }, () => row.error)
        : `${row.member ? "已在群组中" : "未加入"}${row.user?.enabled ? "" : " · 账户已停用"}`,
  },
];
</script>

<template>
  <NCard title="匹配结果">
    <template #header-extra>
      <NText depth="3">
        群组 {{ preview.memberCount }} 人 · 名单 {{ preview.rows.length }} 项
      </NText>
    </template>
    <NFlex :size="20" vertical>
      <NDataTable
        :bordered="false"
        :columns
        :data="preview.rows"
        :row-key="(row) => row.identifier"
        :scroll-x="560"
      />
      <NCollapse v-if="preview.outside.length > 0">
        <NCollapseItem
          name="outside"
          :title="`名单外成员（${preview.outside.length}）`"
        >
          {{ preview.outside.map((user) => user.username).join("、") }}
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NCard>
</template>
