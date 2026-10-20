<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import {
  AuditAssignmentChanges,
  AuditConfigurationChanges,
  AuditHandoverResults,
  EntityReference,
} from "#components";
import { auditOperationLabel, auditOutcomeLabels } from "#shared/labels";
import { formatDateTime } from "#shared/utils";

const { event } = defineProps<{
  event: InternalApi["/api/audit"]["get"]["events"][number];
}>();

const references = computed(() =>
  Object.entries({
    操作者: event.actor,
    目标: event.target,
    群组: event.group,
  }).flatMap(([title, reference]) => (reference ? [{ title, reference }] : [])),
);
</script>

<template>
  <NDrawerContent closable title="操作详情">
    <NEl>
      <NFlex :size="24" vertical>
        <NDescriptions :column="1" label-placement="left" size="small">
          <NDescriptionsItem label="操作">
            {{ auditOperationLabel(event.operation) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="时间">
            {{ formatDateTime(event.createdAt) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="结果">
            {{ auditOutcomeLabels[event.outcome] }}
          </NDescriptionsItem>
          <NDescriptionsItem
            v-for="{ title, reference } in references"
            :key="title"
            :label="title"
          >
            <EntityReference :fallback="reference.id" :reference />
          </NDescriptionsItem>
        </NDescriptions>
        <NAlert v-if="event.error" type="error">
          {{ event.error }}
        </NAlert>
        <AuditAssignmentChanges
          v-if="
            event.operation === 'role.grant' ||
            event.operation === 'role.revoke'
          "
          :after="event.detail.permissionsAfter"
          :before="event.detail.permissionsBefore"
          :label="event.detail.label"
        />
        <AuditHandoverResults
          v-if="event.operation === 'handover.execute'"
          :results="event.detail.results"
        />
        <AuditConfigurationChanges
          v-if="
            (event.operation === 'site.update' ||
              event.operation === 'group.configure' ||
              event.operation === 'invitation.update') &&
            event.detail.after
          "
          :after="event.detail.after"
          :before="event.detail.before"
          :outcome="event.outcome"
        />
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
