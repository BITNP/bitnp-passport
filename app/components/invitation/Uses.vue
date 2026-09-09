<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { AuditReference } from "#components";

type Usage = InternalApi["/api/audit"]["get"]["events"][number];

const { groupId, invitation } = defineProps<{
  groupId: string;
  invitation: { id: string; note: string };
}>();

const page = ref(1);
const { data, error, refresh, status } = await useFetch("/api/audit", {
  query: computed(() => ({
    groupId,
    invitationId: invitation.id,
    operation: "invitation.join",
    outcome: "succeeded",
    first: (page.value - 1) * 50,
  })),
});

const columns: DataTableColumns<Usage> = [
  {
    title: "用户",
    key: "actor",
    render: (usage) =>
      h(AuditReference, {
        reference: usage.actor,
        fallback: usage.actor.id,
      }),
  },
  {
    title: "加入时间",
    key: "completedAt",
    width: 185,
    render: (usage) =>
      new Date(usage.completedAt!).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
      }),
  },
];

useFetchError(error, refresh);
</script>

<template>
  <NDrawerContent closable>
    <template #header>
      <NFlex align="center" :size="16">
        <span>邀请使用记录</span>
        <NButton
          :loading="status === 'pending'"
          size="small"
          @click="refresh()"
        >
          刷新
        </NButton>
      </NFlex>
    </template>
    <NEl>
      <NFlex :size="16" vertical>
        <NText v-if="invitation.note" strong>{{ invitation.note }}</NText>
        <NDataTable
          :bordered="false"
          :columns
          :data="data?.events"
          :loading="status === 'pending'"
          :row-key="(usage) => usage.id"
        >
          <template #empty>
            <NEmpty description="暂无使用记录" />
          </template>
        </NDataTable>
        <ListPagination
          v-if="data"
          v-model:page="page"
          :loading="status === 'pending'"
          :total="data.total"
        />
      </NFlex>
    </NEl>
  </NDrawerContent>
</template>
