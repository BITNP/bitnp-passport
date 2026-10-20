<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { UserPermissionSources } from "#components";

defineProps<{
  permissions: InternalApi["/api/account"]["get"]["permissions"];
  viewerAdministrator: boolean;
}>();
</script>

<template>
  <NFlex class="permissions-panel" :size="14" vertical>
    <NFlex align="center" :size="6">
      <NPopover
        v-if="permissions.activeSources.length > 0"
        placement="bottom-start"
        trigger="click"
      >
        <template #trigger>
          <NButton
            aria-label="网协现任，查看身份来源"
            class="permission-chip"
            round
            secondary
            size="tiny"
            type="success"
          >
            网协现任
          </NButton>
        </template>
        <UserPermissionSources
          :sources="permissions.activeSources"
          :viewer-administrator
        />
      </NPopover>
      <NTag v-else :bordered="false" class="permission-chip" round size="small">
        非网协现任
      </NTag>
      <NTag
        v-if="!permissions.enabled"
        :bordered="false"
        class="permission-chip"
        round
        size="small"
        type="warning"
      >
        账户已停用
      </NTag>
    </NFlex>
    <section class="permission-section">
      <NText class="permission-heading" depth="3" tag="h3">组织归属</NText>
      <NFlex v-if="permissions.memberships.length > 0" :size="6" wrap>
        <NPopover
          v-for="group in permissions.memberships"
          :key="group.id"
          placement="bottom-start"
          trigger="click"
        >
          <template #trigger>
            <NButton
              :aria-label="`${group.label}，查看群组详情`"
              class="permission-chip"
              round
              size="tiny"
              tertiary
            >
              {{ group.label }}
            </NButton>
          </template>
          <NFlex class="group-details" :size="8" vertical>
            <NText strong>{{ group.label }}</NText>
            <NText class="mono" depth="3">{{ group.path }}</NText>
            <NuxtLink
              v-if="viewerAdministrator"
              :to="`/groups/${encodeURIComponent(group.id)}`"
            >
              管理群组
            </NuxtLink>
          </NFlex>
        </NPopover>
      </NFlex>
      <NText v-else depth="3">暂无组织归属</NText>
    </section>
    <section
      v-for="section in [
        { title: '身份与任职', roles: permissions.positions },
        { title: '功能权限', roles: permissions.permissions },
      ]"
      :key="section.title"
      class="permission-section"
    >
      <NText class="permission-heading" depth="3" tag="h3">
        {{ section.title }}
      </NText>
      <NFlex v-if="section.roles.length > 0" :size="6" wrap>
        <NPopover
          v-for="role in section.roles"
          :key="role.name"
          placement="bottom-start"
          trigger="click"
        >
          <template #trigger>
            <NButton
              :aria-label="`${role.label}，查看权限来源`"
              class="permission-chip"
              round
              size="tiny"
              tertiary
            >
              {{ role.label }}
            </NButton>
          </template>
          <UserPermissionSources
            :sources="role.sources"
            :viewer-administrator
          />
        </NPopover>
      </NFlex>
      <NText v-else depth="3">无</NText>
    </section>
    <section class="permission-section">
      <NText class="permission-heading" depth="3" tag="h3">可管理部门</NText>
      <NFlex v-if="permissions.managedDepartments.length > 0" :size="6" wrap>
        <NTag
          v-for="department in permissions.managedDepartments"
          :key="department.code"
          :bordered="false"
          class="permission-chip"
          round
          size="small"
        >
          {{ department.label }}
        </NTag>
      </NFlex>
      <NText v-else depth="3">无管理权限</NText>
    </section>
  </NFlex>
</template>

<style scoped>
.permissions-panel,
.permission-section {
  min-width: 0;
}

.permission-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.permission-heading {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
}

.permission-chip {
  box-sizing: border-box;
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.permission-chip :deep(.n-button__content),
.permission-chip :deep(.n-tag__content) {
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}

.group-details {
  max-width: min(320px, calc(100vw - 48px));
  overflow-wrap: anywhere;
}
</style>
