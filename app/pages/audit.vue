<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NButton, NTag } from "naive-ui";

import { NuxtLink } from "#components";
import { auditOperationLabels, auditOutcomeLabels } from "#shared/labels";

definePageMeta({ middleware: "auth" });
useHead({ title: "审计记录" });

const route = useRoute();
const page = ref(1);
const groupId = computed({
  get: () =>
    typeof route.query.groupId === "string" ? route.query.groupId : "",
  set: (value) => {
    void navigateTo({ query: { ...route.query, groupId: value || undefined } });
  },
});

const [
  { data: groups, error: groupsError, refresh: refreshGroups },
  { data: session },
  { data, error, refresh, status: loadStatus },
] = await Promise.all([
  useFetch("/api/groups"),
  usePortalSession(),
  useFetch("/api/audit", {
    query: computed(() => ({
      first: (page.value - 1) * 50,
      groupId: groupId.value || undefined,
    })),
  }),
]);

watch(groupId, () => {
  page.value = 1;
});

const date = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

type AuditEvent = NonNullable<typeof data.value>["events"][number];
const selected = ref<AuditEvent>();
const selectedGroup = computed(() =>
  groups.value?.find((group) => group.groupId === selected.value?.groupId),
);
const groupOptions = computed(() => {
  const labels = new Map(
    groups.value?.map((group) => [group.groupId, group.label]),
  );

  for (const event of data.value?.events ?? []) {
    if (event.groupId && event.groupLabel) {
      labels.set(event.groupId, event.groupLabel);
    }
  }

  return [
    { label: "全部可见记录", value: "" },
    ...Array.from(labels, ([value, label]) => ({ value, label })),
  ];
});
const columns: DataTableColumns<AuditEvent> = [
  {
    title: "时间",
    key: "createdAt",
    width: 210,
    render: (event) => date(event.createdAt),
  },
  {
    title: "操作",
    key: "operation",
    minWidth: 180,
    render: (event) => {
      const label = auditOperationLabels[event.operation] ?? event.operation;
      if (
        event.jobId &&
        (session.value?.administrator ||
          session.value?.user.subject === event.actorSubject)
      ) {
        return h(NuxtLink, { to: `/jobs/${event.jobId}` }, () => label);
      }

      return label;
    },
  },
  {
    title: "群组",
    key: "groupId",
    minWidth: 160,
    render: (event) => {
      const group = groups.value?.find(
        (group) => group.groupId === event.groupId,
      );
      if (!group) {
        return event.groupLabel ?? "—";
      }

      return h(
        NuxtLink,
        { to: `/groups/${encodeURIComponent(group.groupId)}` },
        () => group.label,
      );
    },
  },
  {
    title: "结果",
    key: "outcome",
    width: 130,
    render: (event) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type:
            event.outcome === "succeeded"
              ? "success"
              : event.outcome === "failed"
                ? "error"
                : event.outcome === "unknown"
                  ? "warning"
                  : "default",
        },
        () => auditOutcomeLabels[event.outcome],
      ),
  },
  {
    title: "详情",
    key: "details",
    width: 90,
    render: (event) =>
      h(
        NButton,
        {
          size: "small",
          onClick: () => {
            selected.value = event;
          },
        },
        () => "查看",
      ),
  },
];

useFetchError(error, refresh);
useFetchError(groupsError, refreshGroups);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title><h1>审计记录</h1></template>
    </NPageHeader>
    <NCard>
      <NFlex :size="20" vertical>
        <NFlex align="center" justify="space-between">
          <NSelect
            v-model:value="groupId"
            class="group-filter"
            :options="groupOptions"
          />
          <NButton @click="refresh()">刷新</NButton>
        </NFlex>
        <NDataTable
          v-if="data"
          :bordered="false"
          :columns
          :data="data.events"
          :loading="loadStatus === 'pending'"
          :row-key="(event) => event.id"
          :scroll-x="810"
        />
        <ListPagination
          v-if="data"
          v-model:page="page"
          :loading="loadStatus === 'pending'"
          :total="data.total"
        />
      </NFlex>
    </NCard>
    <NDrawer
      :show="Boolean(selected)"
      width="min(520px, 100vw)"
      @update:show="selected = undefined"
    >
      <NDrawerContent v-if="selected" closable title="操作详情">
        <NEl>
          <NFlex :size="24" vertical>
            <NDescriptions :column="1" label-placement="top">
              <NDescriptionsItem label="操作">
                {{
                  auditOperationLabels[selected.operation] ?? selected.operation
                }}
              </NDescriptionsItem>
              <NDescriptionsItem label="时间">
                {{ date(selected.createdAt) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="结果">
                {{ auditOutcomeLabels[selected.outcome] }}
              </NDescriptionsItem>
              <NDescriptionsItem label="操作者">
                <NuxtLink
                  v-if="session?.user.subject === selected.actorSubject"
                  to="/account"
                >
                  {{ session.user.displayName }}
                </NuxtLink>
                <NuxtLink
                  v-else-if="session?.administrator"
                  class="mono"
                  :to="`/admin/users/${encodeURIComponent(selected.actorSubject)}`"
                >
                  {{ selected.actorSubject }}
                </NuxtLink>
                <span v-else class="mono">{{ selected.actorSubject }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem v-if="selected.target" label="目标">
                <span class="mono">{{ selected.target }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem v-if="selected.groupId" label="群组">
                <NuxtLink
                  v-if="selectedGroup"
                  :to="`/groups/${encodeURIComponent(selectedGroup.groupId)}`"
                >
                  {{ selectedGroup.label }}
                </NuxtLink>
                <span v-else>{{ selected.groupLabel }}</span>
              </NDescriptionsItem>
            </NDescriptions>
            <NAlert v-if="selected.error" type="error">
              {{ selected.error }}
            </NAlert>
            <NCode
              v-if="Object.keys(selected.detail).length > 0"
              :code="JSON.stringify(selected.detail, null, 2)"
              word-wrap
            />
            <NuxtLink
              v-if="
                selected.jobId &&
                (session?.administrator ||
                  session?.user.subject === selected.actorSubject)
              "
              :to="`/jobs/${selected.jobId}`"
            >
              查看关联任务
            </NuxtLink>
          </NFlex>
        </NEl>
      </NDrawerContent>
    </NDrawer>
  </NuxtLayout>
</template>

<style scoped>
.group-filter {
  width: min(300px, 100%);
}
</style>
