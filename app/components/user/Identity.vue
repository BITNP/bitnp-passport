<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

import { NuxtLink } from "#components";
import type { User } from "#shared/user";

const { size = 24 } = defineProps<{
  user: User;
  showUsername?: boolean;
  size?: number;
  to?: RouteLocationRaw | null;
}>();
</script>

<template>
  <component
    :is="to ? NuxtLink : 'span'"
    class="user-identity"
    v-bind="to ? { to } : {}"
  >
    <UserAvatar aria-hidden="true" class="identity-avatar" :size :user />
    <span class="identity-text">
      <NEllipsis class="identity-name">
        {{ user.name || user.username }}
      </NEllipsis>
      <NText
        v-if="showUsername && user.name && user.name !== user.username"
        class="identity-username"
        depth="3"
      >
        <NEllipsis>{{ user.username }}</NEllipsis>
      </NText>
    </span>
  </component>
</template>

<style scoped>
.user-identity {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}

.identity-avatar {
  flex-shrink: 0;
}

.identity-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.identity-name {
  max-width: 100%;
}

.identity-username {
  font-size: 12px;
  font-weight: 400;
}
</style>
