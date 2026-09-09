<script setup lang="ts">
import { events } from "#shared/events";
import { auditOutcomeLabels } from "#shared/labels";

const emit = defineEmits<{
  search: [query: Record<string, string>];
  refresh: [];
}>();

const { filters, groups, administrator, loading } = defineProps<{
  filters: Record<string, string>;
  groups: { groupId: string; label: string }[];
  administrator?: boolean;
  loading?: boolean;
}>();

interface FilterForm {
  groupId: string | null;
  actor: string | null;
  operation: string | null;
  outcome: string | null;
  period: [number, number] | null;
}

const emptyFilters: Omit<FilterForm, "period"> = {
  groupId: null,
  actor: null,
  operation: null,
  outcome: null,
};

const form = ref<FilterForm>({ ...emptyFilters, period: null });

watch(
  () => filters,
  ({ from, until, ...values }) => {
    form.value = {
      ...emptyFilters,
      ...values,
      period:
        from && until
          ? [new Date(from).getTime(), new Date(until).getTime()]
          : null,
    };
  },
  { immediate: true },
);

function search() {
  const { period, ...values } = form.value;
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries({
    ...values,
    actor: values.actor?.trim(),
    from: period ? new Date(period[0]).toISOString() : null,
    until: period ? new Date(period[1]).toISOString() : null,
  })) {
    if (value != null && value !== "") {
      query[key] = value;
    }
  }

  emit("search", query);
}

function reset() {
  form.value = { ...emptyFilters, period: null };
  search();
}

const operationOptions = Object.entries(events).map(([value, { label }]) => ({
  value,
  label,
}));
const outcomeOptions = Object.entries(auditOutcomeLabels).map(
  ([value, label]) => ({ value, label }),
);
</script>

<template>
  <NForm :show-feedback="false" @submit.prevent="search">
    <NGrid
      cols="1 s:2 l:4"
      item-responsive
      responsive="screen"
      :x-gap="16"
      :y-gap="16"
    >
      <NFormItemGi label="群组">
        <GroupSelect
          v-model:value="form.groupId"
          clearable
          :groups
          placeholder="全部群组"
        />
      </NFormItemGi>
      <NFormItemGi label="操作者">
        <UserAutocomplete
          v-if="administrator"
          v-model:value="form.actor"
          clearable
        />
        <NInput
          v-else
          v-model:value="form.actor"
          clearable
          placeholder="完整用户名或邮箱"
        />
      </NFormItemGi>
      <NFormItemGi label="操作">
        <NSelect
          v-model:value="form.operation"
          clearable
          filterable
          :options="operationOptions"
          placeholder="全部操作"
        />
      </NFormItemGi>
      <NFormItemGi label="结果">
        <NSelect
          v-model:value="form.outcome"
          clearable
          :options="outcomeOptions"
          placeholder="全部结果"
        />
      </NFormItemGi>
      <NFormItemGi label="时间范围" span="1 s:2">
        <NDatePicker
          v-model:value="form.period"
          clearable
          type="datetimerange"
        />
      </NFormItemGi>
      <NFormItemGi label=" " span="1 s:2">
        <NFlex>
          <NButton attr-type="submit" :loading type="primary">筛选</NButton>
          <NButton @click="reset">重置</NButton>
          <NButton @click="emit('refresh')">刷新</NButton>
        </NFlex>
      </NFormItemGi>
    </NGrid>
  </NForm>
</template>
