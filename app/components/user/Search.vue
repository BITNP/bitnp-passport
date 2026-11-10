<script setup lang="ts">
import type { DirectoryUser } from "#shared/user";

const route = useRoute();
const search = ref<string | null>("");

watch(
  () => route.query.search,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);

const searchUsers = () =>
  navigateTo({
    path: "/manage",
    query: { search: search.value ?? undefined },
  });

const openUser = (user: DirectoryUser) =>
  navigateTo(`/manage/users/${encodeURIComponent(user.id)}`);
</script>

<template>
  <NForm @submit.prevent="searchUsers">
    <NInputGroup>
      <UserAutocomplete v-model:value="search" clearable @select="openUser" />
      <NButton attr-type="submit" type="primary">搜索</NButton>
    </NInputGroup>
  </NForm>
</template>
