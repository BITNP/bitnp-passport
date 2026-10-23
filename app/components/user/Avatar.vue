<script setup lang="ts">
import { avatarInitials } from "#shared/avatar";
import type { User } from "#shared/user";

const { user, size = 32 } = defineProps<{
  user: User;
  size?: number;
}>();

const name = computed(() => user.name || user.username);
</script>

<template>
  <NAvatar
    :img-props="{ alt: name }"
    round
    :size
    :src="user.avatarUrl ?? undefined"
  >
    <template v-if="!user.avatarUrl" #default>
      {{ avatarInitials(name) }}
    </template>
    <template #fallback>{{ avatarInitials(name) }}</template>
  </NAvatar>
</template>
