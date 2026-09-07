<script setup lang="ts">
withDefaults(defineProps<{ tone?: "info" | "error" | "success" }>(), {
  tone: "info",
});
</script>

<template>
  <div
    class="notice"
    :class="tone"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <slot />
  </div>
</template>

<style scoped>
.notice {
  background: #edf3ff;
  border: 1px solid #c8dafe;
  color: #31528a;
  padding: 14px 18px;
  border-radius: 9px;
  margin: 16px 0;
  font-size: 0.9rem;
}

.error {
  background: #fff0f0;
  border-color: #f5cccc;
  color: #9b3039;
}

.success {
  background: #edf8f1;
  border-color: #ccebd6;
  color: #246542;
}
</style>
