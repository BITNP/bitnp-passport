<script setup lang="ts">
import { NuxtLink } from "#components";

withDefaults(
  defineProps<{
    to?: string;
    href?: string;
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger" | "text";
    compact?: boolean;
  }>(),
  { type: "button", variant: "primary" },
);
</script>

<template>
  <component
    :is="to ? NuxtLink : href ? 'a' : 'button'"
    :class="
      variant === 'text' ? 'text-button' : ['button', variant, { compact }]
    "
    :href
    :to
    :type="to || href ? undefined : type"
  >
    <slot />
  </component>
</template>

<style scoped>
.button,
.text-button {
  cursor: pointer;
}

.button:disabled,
.text-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 12px 22px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-weight: 500;
  font-size: 0.95rem;
  min-height: 46px;
}

.button:hover {
  text-decoration: none;
  filter: brightness(0.96);
}

.secondary {
  background: var(--surface);
  border-color: var(--border);
  color: #334155;
}

.danger {
  background: #b42335;
  border-color: #b42335;
}

.compact {
  padding: 7px 15px;
  min-height: 36px;
  font-size: 0.85rem;
}

.text-button {
  background: none;
  border: 0;
  color: inherit;
  text-decoration: underline;
  padding: 0 8px;
}

@media (max-width: 640px) {
  .button {
    gap: 12px;
  }
}
</style>
