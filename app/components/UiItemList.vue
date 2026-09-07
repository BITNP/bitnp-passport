<template>
  <ul class="item-list">
    <slot />
  </ul>
</template>

<style scoped>
.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item-list :deep(li) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.item-list :deep(li:last-child) {
  border: 0;
}

.item-list :deep(.muted) {
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .item-list :deep(li) {
    align-items: start;
    flex-wrap: wrap;
  }
}
</style>
