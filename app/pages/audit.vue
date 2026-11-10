<script setup lang="ts">
definePageMeta({ middleware: ["auth", "management"] });

const route = useRoute();
const page = ref(1);
const filters = computed(() => {
  const values: Record<string, string> = {};

  for (const key of [
    "groupId",
    "actor",
    "operation",
    "outcome",
    "from",
    "until",
  ]) {
    const value = route.query[key];
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
});

watch(filters, () => {
  page.value = 1;
});

function search(query: Record<string, string>) {
  page.value = 1;

  return navigateTo({ query });
}

const [
  { data: groups, error: groupsError, refresh: refreshGroups },
  { data, error, refresh, status: loadStatus },
] = await Promise.all([
  useFetch("/api/groups"),
  useFetch("/api/audit", {
    query: computed(() => ({
      first: (page.value - 1) * 50,
      ...filters.value,
    })),
  }),
]);

const groupOptions = computed(() => {
  const labels = new Map(
    groups.value?.map((group) => [group.groupId, group.label]),
  );

  for (const event of data.value?.events ?? []) {
    if (event.group?.label) {
      labels.set(event.group.id, event.group.label);
    }
  }

  return Array.from(labels, ([groupId, label]) => ({ groupId, label }));
});

useFetchError(groupsError, refreshGroups);
</script>

<template>
  <NuxtLayout name="manage" title="操作记录">
    <NCard>
      <NFlex :size="20" vertical>
        <AuditFilters
          :filters
          :groups="groupOptions"
          :loading="loadStatus === 'pending'"
          @refresh="refresh()"
          @search="search"
        />
        <LoadError v-if="error" :error :retry="refresh" />
        <AuditTable
          :loading="loadStatus === 'pending'"
          :records="data?.events"
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
