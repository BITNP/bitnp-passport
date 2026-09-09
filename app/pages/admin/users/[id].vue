<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const [{ data, error, refresh }, { data: session }] = await Promise.all([
  useFetch(
    () => `/api/admin/users/${encodeURIComponent(String(route.params.id))}`,
  ),
  usePortalSession(),
]);
const keycloakPages = {
  settings: "用户信息",
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
                {{
                  [data.user.lastName, data.user.firstName].join("") || " - "
                }}
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
                    : " - "
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
                    :href="`/admin/keycloak?user=${encodeURIComponent(data.user.id)}&page=${page}`"
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
          <NCard title="权限信息">
            <PermissionSources
              :permissions="data.permissions"
              :viewer-administrator="session?.administrator ?? false"
            />
          </NCard>
        </NGi>
      </NGrid>
      <NCard>
        <NCollapse>
          <NCollapseItem name="keycloak" title="Keycloak 详情">
            <NFlex :size="16" vertical>
              <NDescriptions :column="1" label-placement="left" size="small">
                <NDescriptionsItem label="Realm 角色">
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
                  <NText v-else depth="3">无</NText>
                </NDescriptionsItem>
              </NDescriptions>
              <NTable
                v-if="Object.keys(data.user.attributes ?? {}).length > 0"
                :bordered="false"
                class="attributes"
                size="small"
              >
                <thead>
                  <tr>
                    <th>属性</th>
                    <th>值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(values, name) in data.user.attributes"
                    :key="name"
                  >
                    <td class="mono">{{ name }}</td>
                    <td>
                      <div v-for="(value, index) in values" :key="index">
                        {{ value }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </NTable>
            </NFlex>
          </NCollapseItem>
        </NCollapse>
      </NCard>
    </template>
  </NuxtLayout>
</template>

<style scoped>
.user-details {
  overflow-wrap: anywhere;
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
