<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";

import { ConfirmAction, NuxtLink } from "#components";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const groupId = computed(() => String(route.params.id));

const [
  { data: group, error: loadError, refresh, status: loadStatus },
  { data: session },
] = await Promise.all([
  useFetch(() => `/api/groups/${encodeURIComponent(groupId.value)}`),
  usePortalSession(),
]);

const { submit, pending } = useMutation();
const message = useMessage();
const identifier = ref("");
const delegateType = ref<"user" | "group">("user");
const delegate = ref<string | null>(null);

const {
  data: delegateDirectory,
  error: delegateLoadError,
  status: delegateLoadStatus,
  execute: loadDelegateGroups,
} = await useFetch("/api/admin/groups", {
  immediate: false,
  watch: false,
});

async function changeDelegateType(type: string) {
  delegate.value = null;

  if (type === "group") {
    await loadDelegateGroups();
  }
}

useHead({
  title: () => group.value?.settings.label ?? "群组",
});

const addMember = () =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId.value)}/members`, {
      method: "POST",
      body: { identifier: identifier.value },
    });
    identifier.value = "";
    message.success("成员已添加");
    await refresh();
  });

const removeMember = (subject: string) =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId.value)}/members`, {
      method: "DELETE",
      body: { subject },
    });
    message.success("成员已移除");
    await refresh();
  });

const grantDelegate = () =>
  submit(async () => {
    await $fetch("/api/admin/delegations", {
      method: "POST",
      body: {
        groupId: groupId.value,
        type: delegateType.value,
        identifier: delegate.value,
      },
    });
    delegate.value = null;
    message.success("委托权限已授予");
    await refresh();
  });

type Delegate = NonNullable<typeof group.value>["delegates"][number];

const revokeDelegate = (delegate: Delegate) =>
  submit(async () => {
    await $fetch("/api/admin/delegations", {
      method: "DELETE",
      body: {
        groupId: groupId.value,
        type: delegate.type,
        subject: delegate.subject,
      },
    });
    message.success("委托权限已撤销");
    await refresh();
  });

type Member = NonNullable<typeof group.value>["members"][number];
const columns: DataTableColumns<Member> = [
  {
    title: "用户名",
    key: "username",
    minWidth: 160,
    render: (member) => {
      if (session.value?.administrator) {
        return h(
          NuxtLink,
          { to: `/admin/users/${encodeURIComponent(member.id)}` },
          () => member.username,
        );
      }

      if (session.value?.user.subject === member.id) {
        return h(NuxtLink, { to: "/account" }, () => member.username);
      }

      return member.username;
    },
  },
  {
    title: "姓名",
    key: "name",
    minWidth: 120,
    render: (member) => [member.lastName, member.firstName].join("") || "—",
  },
  {
    title: "邮箱",
    key: "email",
    minWidth: 240,
    render: (member) => member.email || "—",
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    render: (member) =>
      h(
        ConfirmAction,
        {
          disabled: pending.value,
          message: `确认将 ${member.username} 从本群组移除？`,
          onConfirm: () => removeMember(member.id),
        },
        { default: () => "移除" },
      ),
  },
];

useFetchError(loadError, refresh);
useFetchError(delegateLoadError, loadDelegateGroups);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader @back="navigateTo('/groups')">
      <template #title>
        <h1>{{ group?.settings.label || "群组" }}</h1>
      </template>
      <template v-if="group" #extra>
        <NFlex :size="12">
          <LinkButton :to="`/jobs?groupId=${encodeURIComponent(groupId)}`">
            批量任务
          </LinkButton>
          <LinkButton :to="`/audit?groupId=${encodeURIComponent(groupId)}`">
            操作记录
          </LinkButton>
          <LinkButton
            v-if="session?.administrator"
            :to="`/admin?groupId=${encodeURIComponent(groupId)}`"
          >
            配置群组
          </LinkButton>
        </NFlex>
      </template>
      <template #footer>
        <NFlex align="center" justify="space-between" :size="16">
          <NText depth="3">{{ group?.directory.path }}</NText>
          <NFlex v-if="group" :size="20">
            <NuxtLink to="#members">成员</NuxtLink>
            <NuxtLink to="#invitations">邀请链接</NuxtLink>
            <NuxtLink to="#delegations">管理授权</NuxtLink>
          </NFlex>
        </NFlex>
      </template>
    </NPageHeader>
    <template v-if="group">
      <NCard id="members" class="group-section" title="群组成员">
        <template #header-extra>
          <LinkButton
            size="small"
            :to="`/groups/${encodeURIComponent(groupId)}/batch`"
          >
            批量管理
          </LinkButton>
        </template>
        <NFlex :size="20" vertical>
          <NText v-if="group.settings.note" depth="3">
            {{ group.settings.note }}
          </NText>
          <NForm @submit.prevent="addMember">
            <NFormItem
              label="添加成员"
              :label-props="{ for: 'member' }"
              :show-feedback="false"
            >
              <NInputGroup>
                <UserAutocomplete
                  v-if="session?.administrator"
                  v-model:value="identifier"
                  :input-props="{
                    id: 'member',
                    autocomplete: 'off',
                    required: true,
                  }"
                />
                <NInput
                  v-else
                  v-model:value="identifier"
                  :input-props="{
                    id: 'member',
                    autocomplete: 'off',
                    required: true,
                  }"
                  placeholder="准确的用户名或邮箱"
                />
                <NButton attr-type="submit" :loading="pending" type="primary">
                  添加
                </NButton>
              </NInputGroup>
            </NFormItem>
          </NForm>
          <NDataTable
            :bordered="false"
            :columns
            :data="group.members"
            :loading="loadStatus === 'pending'"
            :pagination="{
              pageSize: 50,
              pageSlot: 5,
              showQuickJumper: true,
              size: 'small',
            }"
            :row-key="(member) => member.id"
            :scroll-x="680"
          />
        </NFlex>
      </NCard>
      <GroupInvitations
        id="invitations"
        :allow-invites="group.settings.allowInvites"
        class="group-section"
        :group-id
      />
      <NCard id="delegations" class="group-section" title="管理授权">
        <NFlex :size="20" vertical>
          <NForm v-if="session?.administrator" @submit.prevent="grantDelegate">
            <NFormItem label="授权对象">
              <NRadioGroup
                v-model:value="delegateType"
                @update:value="changeDelegateType"
              >
                <NRadioButton value="user">用户</NRadioButton>
                <NRadioButton value="group">群组</NRadioButton>
              </NRadioGroup>
            </NFormItem>
            <NFormItem
              :feedback="
                delegateType === 'group'
                  ? '包含该群组及所有子群组的成员。'
                  : undefined
              "
              :label="delegateType === 'user' ? '用户名或邮箱' : '选择群组'"
            >
              <NInputGroup>
                <UserAutocomplete
                  v-if="delegateType === 'user'"
                  v-model:value="delegate"
                  :input-props="{
                    id: 'delegate',
                    autocomplete: 'off',
                    required: true,
                  }"
                />
                <NTreeSelect
                  v-else
                  v-model:value="delegate"
                  filterable
                  key-field="id"
                  label-field="name"
                  :loading="delegateLoadStatus === 'pending'"
                  :options="delegateDirectory?.groups"
                  placeholder="选择群组"
                  show-path
                />
                <NButton
                  attr-type="submit"
                  :disabled="!delegate"
                  :loading="pending"
                  type="primary"
                >
                  授权
                </NButton>
              </NInputGroup>
            </NFormItem>
          </NForm>
          <NList v-if="group.delegates.length > 0">
            <NListItem
              v-for="item in group.delegates"
              :key="`${item.type}:${item.subject}`"
            >
              <NFlex align="center" :size="12">
                <NTag :bordered="false" size="small">
                  {{ item.type === "user" ? "用户" : "群组" }}
                </NTag>
                <NuxtLink
                  v-if="item.name && session?.administrator"
                  :to="
                    item.type === 'user'
                      ? `/admin/users/${encodeURIComponent(item.subject)}`
                      : `/admin?groupId=${encodeURIComponent(item.subject)}`
                  "
                >
                  {{ item.name }}
                </NuxtLink>
                <NText v-else-if="item.name">{{ item.name }}</NText>
                <NText v-else depth="3">未找到记录（{{ item.subject }}）</NText>
              </NFlex>
              <template #suffix>
                <ConfirmAction
                  v-if="session?.administrator"
                  :disabled="pending"
                  message="确认撤销这项群组管理权限？"
                  @confirm="revokeDelegate(item)"
                >
                  撤销委托
                </ConfirmAction>
              </template>
            </NListItem>
          </NList>
          <NEmpty v-else description="暂无管理授权" />
        </NFlex>
      </NCard>
    </template>
  </NuxtLayout>
</template>

<style scoped>
.group-section {
  scroll-margin-top: 80px;
}
</style>
