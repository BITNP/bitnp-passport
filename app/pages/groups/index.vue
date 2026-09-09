<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag, NText } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { LinkButton } from "#components";

type Group = InternalApi["/api/groups"]["get"][number];

definePageMeta({ middleware: "auth" });
useHead({ title: "群组" });

const [{ data: groups, error, refresh, status }, { data: session }] =
  await Promise.all([useFetch("/api/groups"), usePortalSession()]);

const search = ref("");
const filteredGroups = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();

  return groups.value?.filter((group) =>
    [group.label, group.note].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  );
});

const columns: DataTableColumns<Group> = [
  {
    title: "群组名称",
    key: "label",
    minWidth: 180,
    render: (group) => h(NText, { strong: true }, () => group.label),
  },
  {
    title: "管理备注",
    key: "note",
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: "邀请加入",
    key: "allowInvites",
    width: 120,
    render: (group) =>
      h(
        NTag,
        {
          bordered: false,
          size: "small",
          type: group.allowInvites ? "success" : "default",
        },
        () => (group.allowInvites ? "已开放" : "已关闭"),
      ),
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    render: (group) =>
      h(
        LinkButton,
        { to: `/groups/${encodeURIComponent(group.groupId)}`, size: "small" },
        () => "管理",
      ),
  },
];

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title><h1>我管理的群组</h1></template>
      <template #extra>
        <LinkButton v-if="session?.administrator" to="/admin">
          配置群组
        </LinkButton>
      </template>
    </NPageHeader>
    <NCard v-if="groups" :content-style="{ padding: 0 }">
      <div class="group-toolbar">
        <NText depth="3">{{ groups.length }} 个群组</NText>
        <GroupAutocomplete
          v-model:value="search"
          class="group-search"
          :groups
          placeholder="搜索群组名称或备注"
        />
      </div>
      <NDataTable
        :bordered="false"
        :bottom-bordered="false"
        :columns
        :data="filteredGroups"
        :loading="status === 'pending'"
        :row-key="(group) => group.groupId"
        :scroll-x="600"
      >
        <template #empty>
          <NEmpty
            :description="
              groups.length > 0 ? '没有匹配的群组' : '暂无可管理的群组'
            "
          />
        </template>
      </NDataTable>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.group-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.group-search {
  width: 280px;
}

@media (max-width: 640px) {
  .group-toolbar {
    flex-wrap: wrap;
  }

  .group-search {
    width: 100%;
  }
}
</style>
