<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";

import { NuxtLink } from "#components";
import { jobStatusLabels } from "#shared/labels";

definePageMeta({ middleware: "auth" });
useHead({ title: "后台任务" });

const route = useRoute();
const page = ref(1);
const groupId = computed({
  get: () =>
    typeof route.query.groupId === "string" ? route.query.groupId : "",
  set: (value) => {
    void navigateTo({ query: { ...route.query, groupId: value || undefined } });
  },
});
const [
  { data: groups, error: groupsError, refresh: refreshGroups },
  { data, error, refresh, status: loadStatus },
] = await Promise.all([
  useFetch("/api/groups"),
  useFetch("/api/jobs", {
    query: computed(() => ({
      first: (page.value - 1) * 50,
      groupId: groupId.value || undefined,
    })),
  }),
]);

watch(groupId, () => {
  page.value = 1;
});

const groupOptions = computed(() => {
  const labels = new Map(
    groups.value?.map((group) => [group.groupId, group.label]),
  );

  for (const job of data.value?.jobs ?? []) {
    labels.set(job.groupId, job.groupLabel);
  }

  return [
    { label: "全部群组", value: "" },
    ...Array.from(labels, ([value, label]) => ({ value, label })),
  ];
});
const selectedGroup = computed(() =>
  groups.value?.find((group) => group.groupId === groupId.value),
);

const date = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

type Job = NonNullable<typeof data.value>["jobs"][number];
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
      const group = groups.value?.find(
        (group) => group.groupId === job.groupId,
      );
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
    render: (job) => date(job.createdAt),
  },
];

useFetchError(error, refresh);
useFetchError(groupsError, refreshGroups);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title><h1>后台任务</h1></template>
      <template v-if="selectedGroup" #extra>
        <LinkButton
          :to="`/groups/${encodeURIComponent(selectedGroup.groupId)}/batch`"
        >
          批量管理
        </LinkButton>
      </template>
    </NPageHeader>
    <NCard>
      <NFlex :size="20" vertical>
        <NFlex align="center" justify="space-between">
          <NSelect
            v-model:value="groupId"
            class="group-filter"
            :options="groupOptions"
          />
          <NButton @click="refresh()">刷新</NButton>
        </NFlex>
        <NDataTable
          v-if="data"
          :bordered="false"
          :columns
          :data="data.jobs"
          :loading="loadStatus === 'pending'"
          :row-key="(job) => job.id"
          :scroll-x="680"
        />
        <ListPagination
          v-if="data"
          v-model:page="page"
          :loading="loadStatus === 'pending'"
          :total="data.total"
        />
      </NFlex>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.group-filter {
  width: min(300px, 100%);
}
</style>
