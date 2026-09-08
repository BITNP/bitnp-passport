<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const search = ref("");
const query = ref("");
const page = ref(1);
const first = computed(() => (page.value - 1) * 50);

const {
  data,
  error,
  refresh,
  status: loadStatus,
} = await useFetch("/api/admin/users", {
  query: { search: query, first },
});

function searchUsers() {
  page.value = 1;
  query.value = search.value;
}

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="用户目录">
    <NCard>
      <NFlex :size="20" vertical>
        <NForm @submit.prevent="searchUsers">
          <NInputGroup>
            <NInput
              v-model:value="search"
              clearable
              placeholder="用户名、姓名或邮箱"
            />
            <NButton attr-type="submit" type="primary">搜索</NButton>
          </NInputGroup>
        </NForm>
        <UserTable
          v-if="data"
          :loading="loadStatus === 'pending'"
          :users="data.users"
        >
          <template #actions="{ user }">
            <NButton
              :href="user.keycloakUrl"
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
