<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import type { AuditConfiguration } from "#shared/events";
import { events } from "#shared/events";
import { auditFieldLabels, auditOutcomeLabels } from "#shared/labels";
import { formatDateTime } from "#shared/utils";

const { event, groups } = defineProps<{
  event: InternalApi["/api/audit"]["get"]["events"][number];
  groups: { groupId: string; label: string }[];
}>();

const fields = computed(() => {
  const { before, after } = event.detail;
  if (!after) {
    return [];
  }

  return (Object.keys(after) as (keyof AuditConfiguration)[]).map((key) => ({
    key,
    before: before?.[key],
    after: after[key],
  }));
});

const groupName = (id: string) =>
  groups.find((group) => group.groupId === id)?.label ?? id;

function formatValue(
  value: AuditConfiguration[keyof AuditConfiguration],
  key: keyof AuditConfiguration,
): string {
  if (value === undefined) {
    return "未记录";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "object") {
    return value.length === 0
      ? "无"
      : value
          .map((item) => {
            if ("groupId" in item) {
              return `群组：${groupName(item.groupId)} · 部门代码：${item.code} · 部门名称：${item.departmentName}`;
            }

            return `名称：${item.name} · 地址：${item.url}${
              item.description === undefined
                ? ""
                : ` · 说明：${item.description || "—"}`
            }`;
          })
          .join("；");
  }

  return key === "rootGroupId"
    ? groupName(String(value))
    : String(value) || "—";
}

const columns = computed<DataTableColumns<(typeof fields.value)[number]>>(
  () => [
    {
      title: "字段",
      key: "key",
      width: 115,
      render: (field) => auditFieldLabels[field.key],
    },
    {
      title: "原值",
      key: "before",
      render: (field) =>
        event.detail.before === null
          ? "未配置"
          : formatValue(field.before, field.key),
    },
    {
      title: event.outcome === "succeeded" ? "新值" : "提交值",
      key: "after",
      render: (field) => formatValue(field.after, field.key),
    },
  ],
);
</script>

<template>
  <NDrawerContent closable title="操作详情">
    <NEl>
      <NFlex :size="24" vertical>
        <NDescriptions :column="1" label-placement="left" size="small">
          <NDescriptionsItem label="操作">
            {{ events[event.operation].label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="时间">
            {{ formatDateTime(event.createdAt) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="结果">
            {{ auditOutcomeLabels[event.outcome] }}
          </NDescriptionsItem>
          <NDescriptionsItem label="操作者">
            <AuditReference
              :fallback="event.actor.id"
              :reference="event.actor"
            />
          </NDescriptionsItem>
          <NDescriptionsItem v-if="event.target" label="目标">
            <AuditReference
              :fallback="event.target.id"
              :reference="event.target"
            />
          </NDescriptionsItem>
          <NDescriptionsItem v-if="event.group" label="群组">
            <AuditReference
              :fallback="event.group.id"
              :reference="event.group"
            />
          </NDescriptionsItem>
        </NDescriptions>
        <NAlert v-if="event.error" type="error">
          {{ event.error }}
        </NAlert>
        <NFlex v-if="event.detail.after" :size="12" vertical>
          <NText strong>配置内容</NText>
          <NDataTable
            :columns
            :data="fields"
            :row-key="(field) => field.key"
            size="small"
          />
        </NFlex>
        <NCollapse>
          <NCollapseItem name="raw" title="原始记录">
            <NDescriptions :column="1" label-placement="top" size="small">
              <NDescriptionsItem label="记录 ID">
                {{ event.id }}
              </NDescriptionsItem>
              <NDescriptionsItem label="操作者 ID">
                {{ event.actor.id }}
              </NDescriptionsItem>
              <NDescriptionsItem v-if="event.target" label="目标 ID">
                {{ event.target.id }}
              </NDescriptionsItem>
            </NDescriptions>
            <NCode
              v-if="Object.keys(event.detail).length > 0"
              :code="JSON.stringify(event.detail, null, 2)"
              word-wrap
            />
          </NCollapseItem>
        </NCollapse>
        <NuxtLink v-if="event.jobUrl" :to="event.jobUrl">查看关联任务</NuxtLink>
      </NFlex>
    </NEl>
  </NDrawerContent>
</template>
