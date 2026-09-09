<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

const { user } = defineProps<{
  user: InternalApi["/api/admin/users/:id"]["get"]["user"];
}>();

const keycloakPages = {
  settings: "用户信息",
  groups: "群组管理",
  sessions: "登录会话",
};
</script>

<template>
  <NCard title="账户信息">
    <template #header-extra>
      <NuxtLink :to="{ path: '/audit', query: { actor: user.username } }">
        操作记录
      </NuxtLink>
    </template>
    <NDescriptions :column="1" label-placement="left">
      <NDescriptionsItem label="用户名">
        {{ user.username }}
      </NDescriptionsItem>
      <NDescriptionsItem label="姓名">
        {{ [user.lastName, user.firstName].join("") || " - " }}
      </NDescriptionsItem>
      <NDescriptionsItem label="邮箱">
        <NFlex align="center" :size="8">
          <template v-if="user.email">
            <a :href="`mailto:${user.email}`">{{ user.email }}</a>
            <NTag
              :bordered="false"
              size="small"
              :type="user.emailVerified ? 'success' : 'warning'"
            >
              {{ user.emailVerified ? "已验证" : "未验证" }}
            </NTag>
          </template>
          <NText v-else depth="3">未设置</NText>
        </NFlex>
      </NDescriptionsItem>
      <NDescriptionsItem label="状态">
        <NTag
          :bordered="false"
          size="small"
          :type="user.enabled ? 'success' : 'default'"
        >
          {{ user.enabled ? "已启用" : "已停用" }}
        </NTag>
      </NDescriptionsItem>
      <NDescriptionsItem label="创建时间">
        {{
          user.createdTimestamp
            ? new Date(user.createdTimestamp).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
              })
            : " - "
        }}
      </NDescriptionsItem>
      <NDescriptionsItem label="用户 ID">
        <span class="mono">{{ user.id }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="Keycloak">
        <NFlex :size="16">
          <a
            v-for="(label, page) in keycloakPages"
            :key="page"
            :href="`/admin/keycloak?user=${encodeURIComponent(user.id)}&page=${page}`"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ label }}
          </a>
        </NFlex>
      </NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>
