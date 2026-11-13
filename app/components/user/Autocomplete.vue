<script setup lang="ts">
import type { DirectoryUser } from "#shared/user";
import { userLabel } from "#shared/user";

type UserOption = (typeof options.value)[number];

const emit = defineEmits<{ select: [user: DirectoryUser] }>();
const value = defineModel<string | null>("value", { required: true });

const search = computed(() => value.value?.trim() ?? "");
const { data, error, refresh, status } = await useFetch("/api/manage/users", {
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
      userLabel(user),
      user.email,
      user.githubUsername && `GitHub @${user.githubUsername}`,
    ]
      .filter(Boolean)
      .join("，"),
  }));
});

useFetchError(error, refresh);
</script>

<template>
  <NAutoComplete
    :loading="status === 'pending'"
    :options
    placeholder="搜索姓名、用户名、邮箱或 @GitHub用户名"
    :render-label="(option: UserOption) => option.description"
    :value="value ?? ''"
    @select="
      emit(
        'select',
        data!.users.find((user) => user.username === $event)!,
      )
    "
    @update:value="value = $event"
  />
</template>
