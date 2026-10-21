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

const initials = computed(() => avatarInitials(name));
</script>

<template>
  <NAvatar v-if="src" :img-props="{ alt: name ?? '头像' }" round :size :src>
    <template #fallback>{{ initials }}</template>
  </NAvatar>
  <NAvatar v-else round :size>
    {{ initials }}
  </NAvatar>
</template>
