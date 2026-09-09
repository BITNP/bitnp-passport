<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type Permissions = InternalApi["/api/account"]["get"]["permissions"];
type PermissionGroup = Permissions["memberships"][number];

const { permissions, viewerAdministrator } = defineProps<{
  permissions: Permissions;
  viewerAdministrator: boolean;
}>();

const membershipIds = computed(
  () => new Set(permissions.memberships.map((group) => group.id)),
);

function groupLink(group: PermissionGroup) {
  if (viewerAdministrator) {
    return group.managed
      ? `/groups/${encodeURIComponent(group.id)}`
      : `/admin?groupId=${encodeURIComponent(group.id)}`;
  }

  if (permissions.groups.some((target) => target.groupId === group.id)) {
    return `/groups/${encodeURIComponent(group.id)}`;
  }
}
</script>

<template>
  <NDescriptions :column="1" label-placement="left" size="small">
    <NDescriptionsItem label="身份">
      <NFlex align="center" :size="8">
        <NTag
          :bordered="false"
          size="small"
          :type="permissions.activeSources.length > 0 ? 'success' : 'warning'"
        >
          {{ permissions.activeSources.length > 0 ? "网协现任" : "非网协现任" }}
        </NTag>
        <NPopover v-if="permissions.activeSources.length > 0" trigger="click">
          <template #trigger>
            <NButton size="tiny" text>来源</NButton>
          </template>
          <NFlex :size="12" vertical>
            <div
              v-for="source in permissions.activeSources"
              :key="`${source.group?.id ?? 'user'}:${source.role}`"
            >
              <template v-if="source.group">
                <NuxtLink
                  v-if="groupLink(source.group)"
                  :to="groupLink(source.group)"
                >
                  {{ source.group.label }}
                </NuxtLink>
                <template v-else>{{ source.group.label }}</template>
                <NText v-if="!membershipIds.has(source.group.id)" depth="3">
                  （父群组继承）
                </NText>
                <NText depth="3" tag="div">{{ source.group.path }}</NText>
              </template>
              <template v-else>直接授予</template>
              <NText depth="3" tag="div">角色：{{ source.role }}</NText>
            </div>
          </NFlex>
        </NPopover>
      </NFlex>
    </NDescriptionsItem>
    <NDescriptionsItem label="群组">
      <NFlex v-if="permissions.memberships.length > 0" :size="8">
        <NTag
          v-for="group in permissions.memberships"
          :key="group.id"
          :bordered="false"
          size="small"
          type="info"
        >
          <NuxtLink v-if="groupLink(group)" :to="groupLink(group)">
            {{ group.label }}
          </NuxtLink>
          <template v-else>{{ group.label }}</template>
        </NTag>
      </NFlex>
      <NText v-else depth="3">暂无群组</NText>
    </NDescriptionsItem>
    <NDescriptionsItem label="管理">
      <NFlex :size="8" vertical>
        <NFlex v-if="permissions.administrator" align="center" :size="8">
          <NTag :bordered="false" size="small" type="info">
            <NuxtLink v-if="viewerAdministrator" to="/admin/administrators">
              系统管理员
            </NuxtLink>
            <template v-else>系统管理员</template>
          </NTag>
          <NText depth="3">全部群组</NText>
        </NFlex>
        <NFlex
          v-for="group in permissions.groups"
          :key="group.groupId"
          align="center"
          :size="8"
        >
          <NuxtLink
            :to="`/groups/${encodeURIComponent(group.groupId)}#delegations`"
          >
            {{ group.label }}
          </NuxtLink>
          <NPopover trigger="click">
            <template #trigger>
              <NButton size="tiny" text>来源</NButton>
            </template>
            <NFlex :size="12" vertical>
              <div v-for="source in group.sources" :key="source?.id ?? 'user'">
                <template v-if="source">
                  <NuxtLink v-if="groupLink(source)" :to="groupLink(source)">
                    {{ source.label }}
                  </NuxtLink>
                  <template v-else>{{ source.label }}</template>
                  <NText v-if="!membershipIds.has(source.id)" depth="3">
                    （父群组继承）
                  </NText>
                  <NText depth="3" tag="div">{{ source.path }}</NText>
                </template>
                <NText v-else>直接授予</NText>
              </div>
            </NFlex>
          </NPopover>
        </NFlex>
        <NText
          v-if="!permissions.administrator && permissions.groups.length === 0"
          depth="3"
        >
          无
        </NText>
      </NFlex>
    </NDescriptionsItem>
  </NDescriptions>
</template>
