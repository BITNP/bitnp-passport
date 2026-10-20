<script setup lang="ts">
import type { JobResult } from "#shared/jobs";
import { auditOutcomeLabels } from "#shared/labels";

const { results } = defineProps<{ results?: JobResult[] }>();
</script>

<template>
  <NList v-if="results?.length">
    <NListItem v-for="(result, index) in results" :key="index">
      {{ result.label }}：{{ auditOutcomeLabels[result.outcome] }}
      <NText v-if="result.error" depth="3" tag="div">
        {{ result.error }}
      </NText>
    </NListItem>
  </NList>
</template>
