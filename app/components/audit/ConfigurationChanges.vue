<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import type {
  AuditConfiguration,
  AuditConfigurationEntry,
} from "#shared/events";
import { auditFieldLabels } from "#shared/labels";

const { before, after, outcome } = defineProps<{
  before?: Partial<AuditConfiguration> | null;
  after: AuditConfiguration;
  outcome: InternalApi["/api/audit"]["get"]["events"][number]["outcome"];
}>();

function formatValue([key, value]: AuditConfigurationEntry): string {
  switch (key) {
    case "services": {
      return (
        value
          .map(
            ({ name, url, description }) =>
              `名称：${name}，地址：${url}${
                description === undefined
                  ? ""
                  : `，说明：${description || "无"}`
              }`,
          )
          .join("；") || "无"
      );
    }
    case "allowInvites":
    case "allowRegistration": {
      return value ? "是" : "否";
    }
    default: {
      return String(value) || "未填写";
    }
  }
}

const changes = computed(() => {
  const previous = new Map(
    (Object.entries(before ?? {}) as AuditConfigurationEntry[]).map((entry) => [
      entry[0],
      formatValue(entry),
    ]),
  );

  return (Object.entries(after) as AuditConfigurationEntry[]).map((entry) => ({
    key: entry[0],
    label: auditFieldLabels[entry[0]],
    before: before === null ? "未配置" : (previous.get(entry[0]) ?? "未记录"),
    after: formatValue(entry),
  }));
});

const columns = computed<DataTableColumns<(typeof changes.value)[number]>>(
  () => [
    { title: "字段", key: "label", width: 115 },
    { title: "原值", key: "before" },
    { title: outcome === "succeeded" ? "新值" : "提交值", key: "after" },
  ],
);
</script>

<template>
  <NFlex :size="12" vertical>
    <NText strong>配置内容</NText>
    <NDataTable
      :columns
      :data="changes"
      :row-key="(change) => change.key"
      size="small"
    />
  </NFlex>
</template>
