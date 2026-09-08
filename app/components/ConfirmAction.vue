<script setup lang="ts">
const emit = defineEmits<{ confirm: [] }>();

defineProps<{ message: string; disabled?: boolean; confirmLabel?: string }>();
</script>

<template>
  <NPopconfirm
    :disabled
    negative-text="取消"
    :positive-button-props="{ type: 'error' }"
    :positive-text="confirmLabel || '确认'"
    @positive-click="emit('confirm')"
  >
    <template #trigger>
      <NButton :disabled size="small"><slot /></NButton>
    </template>

    <span class="confirmation">{{ message }}</span>
  </NPopconfirm>
</template>

<style scoped>
.confirmation {
  display: inline-block;
  max-width: 240px;
}
</style>
