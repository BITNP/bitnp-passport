<script setup lang="ts">
const emit = defineEmits<{ confirm: [] }>();

const { confirmType = "error" } = defineProps<{
  message: string;
  disabled?: boolean;
  confirmLabel?: string;
  confirmType?: "primary" | "error";
  primary?: boolean;
}>();
</script>

<template>
  <NPopconfirm
    :disabled
    negative-text="取消"
    :positive-button-props="{ type: confirmType }"
    :positive-text="confirmLabel || '确认'"
    @positive-click="emit('confirm')"
  >
    <template #trigger>
      <NButton
        :disabled
        :size="primary ? 'medium' : 'small'"
        :type="primary ? 'primary' : 'default'"
      >
        <slot />
      </NButton>
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
