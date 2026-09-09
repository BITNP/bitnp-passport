<script setup lang="ts">
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
    { label: "全部群组", groupId: "" },
    ...Array.from(labels, ([groupId, label]) => ({ groupId, label })),
  ];
});
const selectedGroup = computed(() =>
  groups.value?.find((group) => group.groupId === groupId.value),
);

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
          <GroupSelect
            v-model:value="groupId"
            class="group-filter"
            :groups="groupOptions"
          />
          <NButton @click="refresh()">刷新</NButton>
        </NFlex>
        <JobTable
          v-if="data"
          :groups="groups ?? undefined"
          :jobs="data.jobs"
          :loading="loadStatus === 'pending'"
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
