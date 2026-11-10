<script setup lang="ts">
import type { NuxtError } from "#app";

const { error, retry } = defineProps<{
  error: NuxtError;
  retry: () => Promise<void>;
}>();

const retrying = ref(false);

async function retryLoad() {
  retrying.value = true;

  try {
    await retry();
  } finally {
    retrying.value = false;
  }
}
</script>

<template>
  <NAlert title="加载失败" type="error">
    <NFlex align="center" justify="space-between" :size="12">
      <span>{{ (error.data as any)?.message ?? error.message }}</span>
      <NButton :loading="retrying" size="small" @click="retryLoad">
        重试
      </NButton>
    </NFlex>
  </NAlert>
</template>
