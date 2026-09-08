<script setup lang="ts">
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
    path: "/admin/users",
    query: { search: search.value ?? undefined },
  });
</script>

<template>
  <NForm @submit.prevent="searchUsers">
    <NInputGroup>
      <UserAutocomplete v-model:value="search" clearable />
      <NButton attr-type="submit" type="primary">搜索</NButton>
    </NInputGroup>
  </NForm>
</template>
