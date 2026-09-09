<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const [
  { data, error, refresh },
  { data: session },
  {
    data: groups,
    error: groupsError,
    refresh: refreshGroups,
    status: groupsStatus,
  },
] = await Promise.all([
  useFetch(
    () => `/api/admin/users/${encodeURIComponent(String(route.params.id))}`,
  ),
  usePortalSession(),
  useFetch("/api/groups"),
]);

const selectedGroupId = ref<string | null>(null);
const availableGroups = computed(() =>
  groups.value?.filter(
    (group) =>
      !data.value?.permissions.memberships.some(
        (membership) => membership.id === group.groupId,
      ),
  ),
);
const { submit, pending } = useMutation(refresh);
const message = useMessage();

const addGroup = () =>
  submit(async () => {
    await $fetch(
      `/api/groups/${encodeURIComponent(selectedGroupId.value!)}/members`,
      {
        method: "POST",
        body: { identifier: data.value!.user.username },
      },
    );
    selectedGroupId.value = null;
    message.success("已加入群组");
  });

const removeGroup = (groupId: string) =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "DELETE",
      body: { subject: data.value!.user.id },
    });
    message.success("已从群组移除");
  });

watch(
  () => route.params.id,
  () => {
    selectedGroupId.value = null;
  },
);

const keycloakPages = {
  settings: "用户信息",
  groups: "群组管理",
  sessions: "登录会话",
};

useFetchError(error, refresh);
useFetchError(groupsError, refreshGroups);
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
            <template #header-extra>
              <NuxtLink
                :to="{ path: '/audit', query: { actor: data.user.username } }"
              >
                操作记录
              </NuxtLink>
            </template>
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
      <NCard title="所属群组">
        <NFlex :size="20" vertical>
          <NForm v-if="availableGroups" @submit.prevent="addGroup">
            <NFormItem label="添加到群组" :show-feedback="false">
              <NInputGroup>
                <GroupSelect
                  v-model:value="selectedGroupId"
                  clearable
                  :disabled="pending || !data.user.enabled"
                  :groups="availableGroups"
                  :loading="groupsStatus === 'pending'"
                />
                <NButton
                  attr-type="submit"
                  :disabled="!selectedGroupId || !data.user.enabled"
                  :loading="pending"
                  type="primary"
                >
                  添加
                </NButton>
              </NInputGroup>
            </NFormItem>
          </NForm>
          <NList v-if="data.permissions.memberships.length > 0">
            <NListItem
              v-for="group in data.permissions.memberships"
              :key="group.id"
            >
              <NuxtLink :to="`/groups/${encodeURIComponent(group.id)}`">
                {{ group.label }}
              </NuxtLink>
              <NText depth="3" tag="div">{{ group.path }}</NText>
              <template #suffix>
                <ConfirmAction
                  :disabled="pending"
                  :message="`确认将 ${data.user.username} 从 ${group.label} 移除？`"
                  @confirm="removeGroup(group.id)"
                >
                  移除
                </ConfirmAction>
              </template>
            </NListItem>
          </NList>
          <NEmpty v-else description="暂无群组" />
        </NFlex>
      </NCard>
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
