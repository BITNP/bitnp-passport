<script setup lang="ts">
type UserOption = (typeof options.value)[number];

const value = defineModel<string | null>("value", { required: true });

const search = computed(() => value.value?.trim() ?? "");
const { data, error, refresh, status } = await useFetch("/api/admin/users", {
  query: { search },
  enabled: () => search.value.length > 0,
});

const options = computed(() => {
  if (!search.value) {
    return [];
  }

  return (data.value?.users ?? []).map((user) => ({
    value: user.username,
    label: user.username,
    description: [
      user.username,
      [user.lastName, user.firstName].join(""),
      user.email,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
});

useFetchError(error, refresh);
</script>

<template>
  <NAutoComplete
    :loading="status === 'pending'"
    :options
    placeholder="搜索用户名、姓名或邮箱"
    :render-label="(option: UserOption) => option.description"
    :value="value ?? ''"
    @update:value="value = $event"
  />
</template>
