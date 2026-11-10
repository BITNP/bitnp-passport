<script setup lang="ts">
definePageMeta({ middleware: ["auth", "management"] });
useHead({ title: "成员目录" });

const route = useRoute();
const page = computed({
  get: () => Number(route.query.page ?? 1),
  set: (value) => {
    void navigateTo({
      query: { ...route.query, page: value === 1 ? undefined : value },
    });
  },
});

const {
  data,
  error,
  refresh,
  status: loadStatus,
} = await useFetch("/api/manage/users", {
  query: computed(() => ({
    search: route.query.search,
    first: (page.value - 1) * 50,
  })),
});
</script>

<template>
  <NuxtLayout name="manage">
    <NPageHeader>
      <template #title><h1>成员目录</h1></template>
    </NPageHeader>
    <NCard>
      <NFlex :size="20" vertical>
        <UserSearch />
        <LoadError v-if="error" :error :retry="refresh" />
        <UserTable
          v-if="data"
          :loading="loadStatus === 'pending'"
          :user-query="route.query"
          :users="data.users"
        >
          <template #actions="{ user }">
            <LinkButton
              size="small"
              :to="{
                path: `/manage/users/${encodeURIComponent(user.id)}`,
                query: route.query,
              }"
            >
              成员资料
            </LinkButton>
          </template>
        </UserTable>
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
