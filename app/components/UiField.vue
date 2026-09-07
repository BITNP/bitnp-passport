<template>
  <div class="field"><slot /></div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 18px;
}

.field :deep(label) {
  font-size: 0.88rem;
  font-weight: 500;
}

.field :deep(input),
.field :deep(textarea),
.field :deep(select) {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cdd6e3;
  background: white;
  color: inherit;
  border-radius: 7px;
}

.field :deep(textarea) {
  min-height: 140px;
  resize: vertical;
}

.field :deep(small) {
  color: var(--muted);
}
</style>
