<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { NuxtLink } from "#components";
import {
  itemStatusLabels,
  jobOperationLabels,
  jobStatusLabels,
} from "#shared/labels";

definePageMeta({ middleware: "auth" });
useHead({ title: "任务详情" });

const route = useRoute();
const id = computed(() => encodeURIComponent(String(route.params.id)));

const [
  { data, error: loadError, refresh, status },
  { data: groups, error: groupsError, refresh: refreshGroups },
  { data: session },
] = await Promise.all([
  useFetch(() => `/api/jobs/${id.value}`),
  useFetch("/api/groups"),
  usePortalSession(),
]);
const group = computed(() =>
  groups.value?.find((group) => group.groupId === data.value?.job.groupId),
);

const { submit, pending } = useMutation(refresh);
const active = computed(
  () =>
    data.value?.job.status === "queued" || data.value?.job.status === "running",
);

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

type Item = InternalApi["/api/jobs/:id"]["get"]["items"][number];
const columns: DataTableColumns<Item> = [
  {
    title: "操作",
    key: "operation",
    width: 120,
    render: (item) => jobOperationLabels[item.operation],
  },
  {
    title: "目标 ID",
    key: "itemKey",
    minWidth: 300,
    render: (item) => {
      if (session.value?.user.subject === item.itemKey) {
        return h(
          NuxtLink,
          { to: "/account", class: "mono" },
          () => item.itemKey,
        );
      }

      if (session.value?.administrator) {
        return h(
          NuxtLink,
          {
            to: `/admin/users/${encodeURIComponent(item.itemKey)}`,
            class: "mono",
          },
          () => item.itemKey,
        );
      }

      return h("span", { class: "mono" }, item.itemKey);
    },
  },
  {
    title: "状态",
    key: "status",
    width: 110,
    render: (item) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type:
            item.status === "succeeded"
              ? "success"
              : item.status === "failed"
                ? "error"
                : "default",
        },
        () => itemStatusLabels[item.status],
      ),
  },
  {
    title: "说明",
    key: "error",
    minWidth: 200,
    render: (item) => item.error ?? " - ",
  },
];

useFetchError(loadError, refresh);
useFetchError(groupsError, refreshGroups);
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
      <template #title><h1>批量成员变更</h1></template>
      <template v-if="data" #extra>
        <NFlex>
          <LinkButton
            v-if="group"
            :to="`/groups/${encodeURIComponent(group.groupId)}`"
          >
            {{ group.label }}
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
          <NText>
            已完成 {{ data.completed }} / {{ data.items.length }} 项
          </NText>
          <NProgress
            :percentage="Math.round((data.completed / data.items.length) * 100)"
            :processing="active"
            :status="
              data.job.status === 'failed'
                ? 'error'
                : data.job.status === 'succeeded'
                  ? 'success'
                  : 'default'
            "
            type="line"
          />
          <NAlert v-if="data.job.error" type="error">
            {{ data.job.error }}
          </NAlert>
          <NFlex v-if="active || data.job.status === 'failed'">
            <ConfirmAction
              v-if="data.job.status === 'failed'"
              confirm-label="重试任务"
              :disabled="pending"
              message="确认以重试未完成的操作？"
              @confirm="action('retry')"
            >
              重试
            </ConfirmAction>
            <ConfirmAction
              confirm-label="取消任务"
              :disabled="pending"
              message="取消尚未完成的操作？已完成的变更会保留"
              @confirm="action('cancel')"
            >
              取消任务
            </ConfirmAction>
          </NFlex>
        </NFlex>
      </NCard>
      <NCard title="执行明细">
        <NDataTable
          :bordered="false"
          :columns
          :data="data.items"
          :row-key="(item) => `${item.operation}:${item.itemKey}`"
          :scroll-x="720"
        />
      </NCard>
    </template>
  </NuxtLayout>
</template>
