<script setup lang="ts">
import { avatarInitials } from "#shared/avatar";

const {
  src = null,
  name = null,
  size = 32,
} = defineProps<{
  src?: string | null;
  name?: string | null;
  size?: number;
}>();
</script>

<template>
  <NAvatar
    :img-props="{ alt: name ?? '头像' }"
    round
    :size
    :src="src ?? undefined"
  >
    <template v-if="!src" #default>{{ avatarInitials(name) }}</template>
    <template #fallback>{{ avatarInitials(name) }}</template>
  </NAvatar>
</template>
