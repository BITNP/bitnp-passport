<script setup lang="ts">
const colorMode = useColorMode();

const options = [
  { label: "浅色", key: "light" },
  { label: "深色", key: "dark" },
  { label: "跟随系统", key: "system" },
];
</script>

<template>
  <NDropdown
    :options
    trigger="click"
    :value="colorMode.preference"
    @select="colorMode.preference = $event"
  >
    <NButton circle quaternary size="small" title="切换主题">
      <template #icon>
        <svg
          fill="none"
          height="20"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          width="20"
        >
          <template v-if="colorMode.preference === 'light'">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
            />
          </template>
          <path
            v-else-if="colorMode.preference === 'dark'"
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
