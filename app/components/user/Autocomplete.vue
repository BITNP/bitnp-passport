<script setup lang="ts">
import { userLabel } from "#shared/user";

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
    description: [userLabel(user), user.email].filter(Boolean).join("，"),
  }));
});

useFetchError(error, refresh);
</script>

<template>
  <NAutoComplete
    :loading="status === 'pending'"
    :options
    placeholder="搜索姓名、用户名或邮箱"
    :render-label="(option: UserOption) => option.description"
    :value="value ?? ''"
    @update:value="value = $event"
  />
</template>
