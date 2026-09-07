<script setup lang="ts">
defineProps<{ success?: boolean }>();
</script>

<template>
  <span class="badge" :class="{ success }"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-block;
  background: #eef2f7;
  color: #5b6676;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 0.72rem;
}

.success {
  background: #e7f5ed;
  color: #24734c;
}
</style>
