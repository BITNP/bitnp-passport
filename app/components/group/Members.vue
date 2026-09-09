<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import type { InternalApi } from "nitropack/types";

import { ConfirmAction, NuxtLink } from "#components";

type Member = InternalApi["/api/groups/:id"]["get"]["members"][number];

const { groupId, members, note, loading, session, refresh } = defineProps<{
  groupId: string;
  members: Member[];
  note: string;
  loading: boolean;
  session: InternalApi["/api/session"]["get"] | undefined;
  refresh: () => Promise<void>;
}>();
const { submit, pending } = useMutation(refresh);
const message = useMessage();
const identifier = ref("");

const addMember = () =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      body: { identifier: identifier.value },
    });
    identifier.value = "";
    message.success("成员已添加");
  });

const removeMember = (subject: string) =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "DELETE",
      body: { subject },
    });
    message.success("成员已移除");
  });

const columns: DataTableColumns<Member> = [
  {
    title: "用户名",
    key: "username",
    minWidth: 160,
    render: (member) => {
      if (session?.administrator) {
        return h(
          NuxtLink,
          { to: `/admin/users/${encodeURIComponent(member.id)}` },
          () => member.username,
        );
      }

      if (session?.user.subject === member.id) {
        return h(NuxtLink, { to: "/account" }, () => member.username);
      }

      return member.username;
    },
  },
  {
    title: "姓名",
    key: "name",
    minWidth: 120,
    render: (member) => [member.lastName, member.firstName].join("") || " - ",
  },
  {
    title: "邮箱",
    key: "email",
    minWidth: 240,
    render: (member) => member.email || " - ",
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
</script>

<template>
  <NCard title="群组成员">
    <template #header-extra>
      <LinkButton
        size="small"
        :to="`/groups/${encodeURIComponent(groupId)}/batch`"
      >
        批量管理
      </LinkButton>
    </template>
    <NFlex :size="20" vertical>
      <NText v-if="note" depth="3">{{ note }}</NText>
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
        :data="members"
        :loading
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
</template>
