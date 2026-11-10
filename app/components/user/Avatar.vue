<script setup lang="ts">
import { avatarInitials } from "#shared/avatar";
import type { User } from "#shared/user";

const { user, size = 32 } = defineProps<{
  user: User;
  size?: number;
}>();
</script>

<template>
  <NAvatar
    :img-props="{ alt: user.name }"
    round
    :size
    :src="user.avatarUrl ?? undefined"
  >
    <template v-if="!user.avatarUrl" #default>
      {{ avatarInitials(user.name) }}
    </template>
    <template #fallback>{{ avatarInitials(user.name) }}</template>
  </NAvatar>
</template>
