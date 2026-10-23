<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";

import { UserIdentity } from "#components";
import type { MembershipPreview } from "#shared/types";

const { preview } = defineProps<{ preview: MembershipPreview }>();

const columns: DataTableColumns<MembershipPreview["matched"][number]> = [
  { title: "输入", key: "identifier", minWidth: 200 },
  {
    title: "匹配账户",
    key: "user",
    minWidth: 220,
    render: (row) => h(UserIdentity, { user: row.user, showUsername: true }),
  },
  {
    title: "当前状态",
    key: "status",
    minWidth: 200,
    render: (row) =>
      `${row.member ? "已在群组中" : "未加入"}${row.user.enabled ? "" : "，账户已停用"}`,
  },
];
</script>

<template>
  <NCard title="匹配结果">
    <template #header-extra>
      <NText depth="3">
        群组共 {{ preview.memberCount }} 人，名单共
        {{ preview.matched.length + preview.unmatched.length }} 项
      </NText>
    </template>
    <NFlex :size="20" vertical>
      <NAlert
        v-if="preview.unmatched.length > 0"
        title="未找到账户"
        type="warning"
      >
        {{ preview.unmatched.join("、") }}
      </NAlert>
      <NDataTable
        :bordered="false"
        :columns
        :data="preview.matched"
        :row-key="(row) => row.identifier"
        :scroll-x="620"
      />
      <NCollapse v-if="preview.outside.length > 0">
        <NCollapseItem
          name="outside"
          :title="`名单外成员（${preview.outside.length}）`"
        >
          <NFlex :size="[16, 8]" wrap>
            <UserIdentity
              v-for="user in preview.outside"
              :key="user.id"
              show-username
              :user
            />
          </NFlex>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NCard>
</template>
