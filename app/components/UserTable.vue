<script setup lang="ts" generic="T extends UserListItem">
import type { DataTableColumns } from "naive-ui";
import { NFlex, NTag } from "naive-ui";
import type { VNode } from "vue";
import type { LocationQueryRaw } from "vue-router";

import { NuxtLink } from "#components";
import type { UserListItem } from "#shared/types";

const { userQuery } = defineProps<{
  users: T[];
  loading?: boolean;
  userQuery?: LocationQueryRaw;
}>();

const slots = defineSlots<{
  actions: (props: { user: T }) => VNode[];
}>();

const { data: session } = await usePortalSession();

const columns: DataTableColumns<T> = [
  {
    title: "用户名",
    key: "username",
    minWidth: 160,
    render: (user) =>
      h(NFlex, { align: "center", size: 8 }, () => [
        user.username === null
          ? "未找到账户"
          : h(
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
    render: (user) => [user.lastName, user.firstName].join("") || "—",
  },
  {
    title: "邮箱",
    key: "email",
    minWidth: 240,
    render: (user) =>
      user.email ? h("a", { href: `mailto:${user.email}` }, user.email) : "—",
  },
  {
    title: "状态",
    key: "enabled",
    width: 110,
    render: (user) => {
      if (user.username === null) {
        return "—";
      }

      return h(
        NTag,
        {
          size: "small",
          bordered: false,
          type: user.enabled ? "success" : "default",
        },
        () => (user.enabled ? "已启用" : "已停用"),
      );
    },
  },
  {
    title: "创建时间",
    key: "createdTimestamp",
    width: 200,
    render: (user) =>
      user.createdTimestamp
        ? new Date(user.createdTimestamp).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
          })
        : "—",
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
    :row-key="(user: T) => user.id"
    :scroll-x="940"
  />
</template>
