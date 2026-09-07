<script setup lang="ts">
import { NuxtLink } from "#components";

withDefaults(
  defineProps<{
    as?: "section" | "div" | "article" | "form";
    to?: string;
    href?: string;
  }>(),
  { as: "section" },
);
</script>

<template>
  <component
    :is="to ? NuxtLink : href ? 'a' : as"
    class="panel"
    :class="{ linked: to || href }"
    :href
    :to
  >
    <slot />
  </component>
</template>

<style scoped>
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  margin-bottom: 22px;
}

.linked {
  display: block;
  color: inherit;
  margin-bottom: 0;
  transition:
    transform 0.15s,
    border-color 0.15s;
}

.linked:hover {
  text-decoration: none;
  transform: translateY(-3px);
  border-color: #b6c9ed;
}

.linked :deep(h3) {
  display: flex;
  justify-content: space-between;
}

.linked :deep(h3 span) {
  color: var(--accent);
}

.linked :deep(p) {
  font-size: 0.9rem;
  margin: 0;
}

@media (max-width: 640px) {
  .panel {
    padding: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .linked:hover {
    transform: none;
  }
}
</style>
