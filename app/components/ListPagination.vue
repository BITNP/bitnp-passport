<script setup lang="ts">
defineProps<{ total: number; loading?: boolean }>();

const page = defineModel<number>("page", { required: true });
</script>

<template>
  <NPagination
    v-model:page="page"
    class="pagination"
    :disabled="loading"
    :item-count="total"
    :page-size="50"
    :page-slot="5"
    show-quick-jumper
    size="small"
  />
</template>

<style scoped>
.pagination {
  align-self: flex-end;
}
</style>
