<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

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
} = await useFetch("/api/admin/users", {
  query: computed(() => ({
    search: route.query.search,
    first: (page.value - 1) * 50,
  })),
});

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="用户目录">
    <NCard>
      <NFlex :size="20" vertical>
        <UserSearch />
        <UserTable
          v-if="data"
          :loading="loadStatus === 'pending'"
          :user-query="route.query"
          :users="data.users"
        >
          <template #actions="{ user }">
            <NButton
              :href="`/admin/keycloak?user=${encodeURIComponent(user.id)}`"
              size="small"
              tag="a"
              target="_blank"
            >
              Keycloak
            </NButton>
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
