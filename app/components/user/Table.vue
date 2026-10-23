<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NFlex, NTag } from "naive-ui";
import type { VNode } from "vue";
import type { LocationQueryRaw } from "vue-router";

import { UserIdentity } from "#components";
import type { DirectoryUser } from "#shared/user";
import { formatDateTime } from "#shared/utils";

const { userQuery } = defineProps<{
  users: DirectoryUser[];
  loading?: boolean;
  userQuery?: LocationQueryRaw;
}>();

const slots = defineSlots<{
  actions: (props: { user: DirectoryUser }) => VNode[];
}>();

const { data: session } = await usePortalSession();

const columns: DataTableColumns<DirectoryUser> = [
  {
    title: "用户",
    key: "user",
    minWidth: 240,
    render: (user) =>
      h(NFlex, { align: "center", size: 8 }, () => [
        h(UserIdentity, {
          user,
          showUsername: true,
          to: {
            path: `/admin/users/${encodeURIComponent(user.id)}`,
            query: userQuery,
          },
        }),
        session.value?.user.id === user.id
          ? h(NTag, { bordered: false, size: "small" }, () => "当前账户")
          : null,
      ]),
  },
  {
    title: "邮箱",
    key: "email",
    minWidth: 240,
    render: (user) =>
      user.email ? h("a", { href: `mailto:${user.email}` }, user.email) : " - ",
  },
  {
    title: "状态",
    key: "enabled",
    width: 110,
    render: (user) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          type: user.enabled ? "success" : "default",
        },
        () => (user.enabled ? "已启用" : "已停用"),
      ),
  },
  {
    title: "创建时间",
    key: "createdTimestamp",
    width: 200,
    render: (user) =>
      user.createdTimestamp ? formatDateTime(user.createdTimestamp) : " - ",
  },
  {
    title: "操作",
    key: "actions",
    width: 110,
    render: (user) => slots.actions({ user }),
  },
];
</script>

<template>
  <NDataTable
    :bordered="false"
    :columns
    :data="users"
    :loading
    :row-key="(user: DirectoryUser) => user.id"
    :scroll-x="900"
  />
</template>
