<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NFlex, NTag } from "naive-ui";
import type { InternalApi } from "nitropack/types";
import type { VNode } from "vue";
import type { LocationQueryRaw } from "vue-router";

import { NuxtLink } from "#components";
import { formatDateTime } from "#shared/utils";

type User = InternalApi["/api/admin/users"]["get"]["users"][number];

const { userQuery } = defineProps<{
  users: User[];
  loading?: boolean;
  userQuery?: LocationQueryRaw;
}>();

const slots = defineSlots<{
  actions: (props: { user: User }) => VNode[];
}>();

const { data: session } = await usePortalSession();

const columns: DataTableColumns<User> = [
  {
    title: "用户名",
    key: "username",
    minWidth: 160,
    render: (user) =>
      h(NFlex, { align: "center", size: 8 }, () => [
        h(
          NuxtLink,
          {
            to: {
              path: `/admin/users/${encodeURIComponent(user.id)}`,
              query: userQuery,
            },
          },
          () => user.username,
        ),
        session.value?.user.subject === user.id
          ? h(NTag, { bordered: false, size: "small" }, () => "当前账户")
          : null,
      ]),
  },
  {
    title: "姓名",
    key: "name",
    minWidth: 120,
    render: (user) => [user.lastName, user.firstName].join("") || " - ",
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
    :row-key="(user: User) => user.id"
    :scroll-x="940"
  />
</template>
