<script setup lang="ts">
defineProps<{ panel?: boolean }>();
</script>

<template>
  <UiPanel v-if="panel">
    <div class="empty"><slot /></div>
  </UiPanel>
  <p v-else class="empty inset"><slot /></p>
</template>

<style scoped>
.empty {
  color: var(--muted);
  text-align: center;
  font-size: 0.95rem;
}

.inset {
  padding: 30px;
}
</style>
