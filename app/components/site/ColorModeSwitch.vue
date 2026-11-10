<script setup lang="ts">
import type { DropdownOption } from "naive-ui";

const colorMode = useColorMode();

const modes = [
  { label: "跟随系统", key: "system" },
  { label: "浅色", key: "light" },
  { label: "深色", key: "dark" },
];

const current = computed(
  () => modes.find((mode) => mode.key === colorMode.preference) ?? modes[0]!,
);
const options = computed<DropdownOption[]>(() =>
  modes.map((mode) => ({
    ...mode,
    icon: () => h("span", mode === current.value ? "✓" : ""),
  })),
);
</script>

<template>
  <NDropdown
    :options
    placement="bottom-end"
    trigger="click"
    @select="colorMode.preference = $event"
  >
    <NButton
      :aria-label="`颜色模式：${current.label}`"
      circle
      quaternary
      size="small"
    >
      <template #icon>
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          width="20"
        >
          <template v-if="current.key === 'light'">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
            />
          </template>
          <path
            v-else-if="current.key === 'dark'"
            d="M20.9 13.2A9 9 0 0 1 10.8 3.1a9 9 0 1 0 10.1 10.1Z"
          />
          <template v-else>
            <rect height="13" rx="2" width="18" x="3" y="4" />
            <path d="M12 17v4m-4 0h8" />
          </template>
        </svg>
      </template>
    </NButton>
  </NDropdown>
</template>
