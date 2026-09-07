<template>
  <div class="page-heading"><slot /></div>
</template>

<style scoped>
.page-heading {
  padding: 38px 0 24px;
}

.page-heading :deep(h1) {
  margin-bottom: 12px;
}

.page-heading :deep(.eyebrow) {
  margin-bottom: 14px;
}

@media (max-width: 640px) {
  .page-heading {
    padding-top: 28px;
  }
}
</style>
