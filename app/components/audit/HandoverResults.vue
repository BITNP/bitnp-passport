<script setup lang="ts">
import type { JobResult } from "#shared/jobs";
import { itemStatusLabels } from "#shared/labels";

const { results } = defineProps<{ results?: JobResult[] | null }>();
</script>

<template>
  <NList v-if="results?.length">
    <NListItem v-for="(result, index) in results" :key="index">
      {{ result.label }}：{{ itemStatusLabels[result.outcome] }}
      <NText v-if="result.error" depth="3" tag="div">
        {{ result.error }}
      </NText>
    </NListItem>
  </NList>
</template>
