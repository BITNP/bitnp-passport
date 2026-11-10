<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import type {
  AuditConfiguration,
  AuditConfigurationFields,
  AuditConfigurationKey,
} from "#shared/events";
import { auditConfigurationKeys } from "#shared/events";
import { auditFieldLabels } from "#shared/labels";

type AuditEvent = InternalApi["/api/audit"]["get"]["events"][number];

const { before, after, outcome } = defineProps<{
  before?: Partial<AuditConfiguration> | null;
  after: AuditConfiguration;
  outcome: AuditEvent["outcome"];
}>();

interface ConfigurationEntry {
  key: AuditConfigurationKey;
  value: AuditConfigurationFields[AuditConfigurationKey];
}

function formatValue({ key, value }: ConfigurationEntry): string {
  if (key === "services" && Array.isArray(value)) {
    return (
      value
        .map(
          ({ name, url, description }) =>
            `名称：${name}，地址：${url}${
              description === undefined ? "" : `，说明：${description || "无"}`
            }`,
        )
        .join("；") || "无"
    );
  }
  if (key === "allowInvites" || key === "allowRegistration") {
    return value ? "是" : "否";
  }

  return String(value) || "未填写";
}

const configurationEntries = (
  config: Partial<AuditConfigurationFields>,
): ConfigurationEntry[] =>
  auditConfigurationKeys.flatMap((key) => {
    const value = config[key];

    return value === undefined ? [] : [{ key, value }];
  });

const changes = computed(() => {
  const previous = new Map(
    configurationEntries(before ?? {}).map((entry) => [
      entry.key,
      formatValue(entry),
    ]),
  );

  return configurationEntries(after).map((entry) => ({
    key: entry.key,
    label: auditFieldLabels[entry.key],
    before: before === null ? "未配置" : (previous.get(entry.key) ?? "未记录"),
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
