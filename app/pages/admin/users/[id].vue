<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const { data, error, refresh } = await useFetch(
  () => `/api/admin/users/${encodeURIComponent(String(route.params.id))}`,
);
const keycloakPages = {
  profile: "用户信息",
  groups: "群组管理",
  sessions: "登录会话",
};

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout
    :back="{ path: '/admin/users', query: route.query }"
    name="admin"
    :title="data?.user.username || '用户详情'"
  >
    <NCard>
      <UserSearch />
    </NCard>
    <template v-if="data">
      <NGrid
        class="user-details"
        cols="1 m:5"
        item-responsive
        responsive="screen"
        :x-gap="20"
        :y-gap="20"
      >
        <NGi span="1 m:3">
          <NCard title="账户信息">
            <NDescriptions :column="1" label-placement="left">
              <NDescriptionsItem label="用户名">
                {{ data.user.username }}
              </NDescriptionsItem>
              <NDescriptionsItem label="姓名">
                {{ [data.user.lastName, data.user.firstName].join("") || "—" }}
              </NDescriptionsItem>
              <NDescriptionsItem label="邮箱">
                <NFlex align="center" :size="8">
                  <template v-if="data.user.email">
                    <a :href="`mailto:${data.user.email}`">
                      {{ data.user.email }}
                    </a>
                    <NTag
                      :bordered="false"
                      size="small"
                      :type="data.user.emailVerified ? 'success' : 'warning'"
                    >
                      {{ data.user.emailVerified ? "已验证" : "未验证" }}
                    </NTag>
                  </template>
                  <NText v-else depth="3">未设置</NText>
                </NFlex>
              </NDescriptionsItem>
              <NDescriptionsItem label="状态">
                <NTag
                  :bordered="false"
                  size="small"
                  :type="data.user.enabled ? 'success' : 'default'"
                >
                  {{ data.user.enabled ? "已启用" : "已停用" }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="创建时间">
                {{
                  data.user.createdTimestamp
                    ? new Date(data.user.createdTimestamp).toLocaleString(
                        "zh-CN",
                        { timeZone: "Asia/Shanghai" },
                      )
                    : "—"
                }}
              </NDescriptionsItem>
              <NDescriptionsItem label="用户 ID">
                <span class="mono">{{ data.user.id }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="Keycloak">
                <NFlex :size="16">
                  <a
                    v-for="(label, page) in keycloakPages"
                    :key="page"
                    :href="data.keycloak[page]"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {{ label }}
                  </a>
                </NFlex>
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </NGi>
        <NGi span="1 m:2">
          <NCard title="群组与权限">
            <NDescriptions :column="1" label-placement="left">
              <NDescriptionsItem label="所属群组">
                <NFlex v-if="data.groups.length > 0" :size="8" vertical>
                  <div v-for="group in data.groups" :key="group.id">
                    <NuxtLink
                      :to="
                        group.managed
                          ? `/groups/${encodeURIComponent(group.id)}`
                          : `/admin?groupId=${encodeURIComponent(group.id)}`
                      "
                    >
                      {{ group.label }}
                    </NuxtLink>
                    <NText class="group-path" depth="3" tag="div">
                      {{ group.path }}
                    </NText>
                  </div>
                </NFlex>
                <NText v-else depth="3">暂无群组</NText>
              </NDescriptionsItem>
              <NDescriptionsItem label="本站权限">
                <NFlex align="center" :size="8">
                  <template v-if="data.permissions.administrator">
                    <NTag :bordered="false" size="small" type="info">
                      系统管理员
                    </NTag>
                    <NuxtLink to="/groups">全部群组</NuxtLink>
                  </template>
                  <template v-else-if="data.permissions.groups.length > 0">
                    <NTag :bordered="false" size="small" type="info">
                      群组管理员
                    </NTag>
                    <NuxtLink
                      v-for="group in data.permissions.groups"
                      :key="group.groupId"
                      :to="`/groups/${encodeURIComponent(group.groupId)}`"
                    >
                      {{ group.label }}
                    </NuxtLink>
                  </template>
                  <NText v-else depth="3">无管理权限</NText>
                </NFlex>
              </NDescriptionsItem>
              <NDescriptionsItem label="Keycloak Realm 角色">
                <NFlex v-if="data.roles.length > 0" :size="8">
                  <NTag
                    v-for="role in data.roles"
                    :key="role.id"
                    :bordered="false"
                    size="small"
                  >
                    {{ role.name }}
                  </NTag>
                </NFlex>
                <NText v-else depth="3">暂无 Realm 角色</NText>
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </NGi>
      </NGrid>
      <NCard
        v-if="Object.keys(data.user.attributes ?? {}).length > 0"
        title="Keycloak 属性"
      >
        <NTable :bordered="false" class="attributes" size="small">
          <thead>
            <tr>
              <th>属性</th>
              <th>值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(values, name) in data.user.attributes" :key="name">
              <td class="mono">{{ name }}</td>
              <td>
                <div v-for="(value, index) in values" :key="index">
                  {{ value }}
                </div>
              </td>
            </tr>
          </tbody>
        </NTable>
      </NCard>
    </template>
  </NuxtLayout>
</template>

<style scoped>
.user-details {
  overflow-wrap: anywhere;
}

.group-path {
  font-size: 12px;
}

.attributes {
  table-layout: fixed;
  overflow-wrap: anywhere;
}

.attributes th:first-child {
  width: 30%;
}

.attributes td {
  vertical-align: top;
}
</style>
