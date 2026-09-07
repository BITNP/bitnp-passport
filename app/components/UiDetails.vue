<template>
  <dl class="details"><slot /></dl>
</template>

<style scoped>
.details {
  margin: 0 0 22px;
}

.details > :deep(div) {
  display: grid;
  grid-template-columns: 85px 1fr;
  gap: 15px;
  padding: 9px 0;
}

.details :deep(dt) {
  font-size: 0.9rem;
  color: var(--muted);
}

.details :deep(dd) {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
