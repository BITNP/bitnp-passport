<script setup lang="ts">
import { jobStatusLabels } from "#shared/labels";

definePageMeta({ middleware: "auth" });
useHead({ title: "任务详情" });

const route = useRoute();
const id = computed(() => encodeURIComponent(String(route.params.id)));

const {
  data,
  error: loadError,
  refresh,
  status,
} = await useFetch(() => `/api/jobs/${id.value}`);

const { submit, pending } = useMutation(refresh);
const active = computed(
  () =>
    data.value?.job.status === "queued" || data.value?.job.status === "running",
);
const progressStatus = {
  queued: "default",
  running: "default",
  succeeded: "success",
  failed: "error",
  cancelled: "default",
} as const;

const poll = setInterval(() => {
  if (active.value && status.value !== "pending") {
    void refresh();
  }
}, 3000);

onUnmounted(() => clearInterval(poll));

const action = (name: "retry" | "cancel") =>
  submit(async () => {
    await $fetch(`/api/jobs/${id.value}/${name}`, { method: "POST" });
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader
      @back="
        navigateTo(
          data
            ? `/jobs?groupId=${encodeURIComponent(data.job.groupId)}`
            : '/jobs',
        )
      "
    >
      <template #title>
        <h1>{{ data?.job.title ?? "任务详情" }}</h1>
      </template>
      <template v-if="data" #extra>
        <NFlex>
          <LinkButton v-if="data.job.group.to" :to="data.job.group.to">
            {{ data.job.group.label }}
          </LinkButton>
          <LinkButton
            :to="`/audit?groupId=${encodeURIComponent(data.job.groupId)}`"
          >
            群组记录
          </LinkButton>
        </NFlex>
      </template>
    </NPageHeader>
    <template v-if="data">
      <NCard :title="jobStatusLabels[data.job.status]">
        <template #header-extra>
          <NButton
            :loading="status === 'pending'"
            size="small"
            @click="refresh()"
          >
            刷新
          </NButton>
        </template>
        <NFlex :size="20" vertical>
          <NText>已完成 {{ data.completed }} / {{ data.total }} 项</NText>
          <NProgress
            :percentage="
              Math.round((data.completed / Math.max(data.total, 1)) * 100)
            "
            :processing="active"
            :status="progressStatus[data.job.status]"
            type="line"
          />
          <NAlert v-if="data.job.error" type="error">
            {{ data.job.error }}
          </NAlert>
          <NAlert v-if="data.notice" type="warning">{{ data.notice }}</NAlert>
          <NFlex v-if="data.actions.length > 0">
            <ConfirmAction
              v-for="item in data.actions"
              :key="item.name"
              :confirm-label="item.label"
              :disabled="pending"
              :message="item.confirmation"
              @confirm="action(item.name)"
            >
              {{ item.label }}
            </ConfirmAction>
          </NFlex>
          <LinkButton v-if="data.followup" :to="data.followup.to">
            {{ data.followup.label }}
          </LinkButton>
        </NFlex>
      </NCard>
      <JobItems :items="data.items" />
    </template>
  </NuxtLayout>
</template>
