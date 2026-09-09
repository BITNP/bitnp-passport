<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { flattenGroups } from "~/utils/groupDirectory";

type Delegate = InternalApi["/api/groups/:id"]["get"]["delegates"][number];

const { groupId, delegates, session, refresh } = defineProps<{
  groupId: string;
  delegates: Delegate[];
  session: InternalApi["/api/session"]["get"] | undefined;
  refresh: () => Promise<void>;
}>();
const { submit, pending } = useMutation(refresh);
const message = useMessage();
const delegate = reactive<{
  type: "user" | "group";
  identifier: string | null;
}>({
  type: "user",
  identifier: null,
});

const {
  data: directory,
  error,
  status,
  execute: loadGroups,
} = await useFetch("/api/admin/groups", {
  immediate: false,
  watch: false,
});

const groups = computed(() =>
  flattenGroups(directory.value?.groups ?? [], directory.value?.settings ?? []),
);

async function changeType(type: string) {
  delegate.identifier = null;

  if (type === "group") {
    await loadGroups();
  }
}

const grant = () =>
  submit(async () => {
    await $fetch("/api/admin/delegations", {
      method: "POST",
      body: { groupId, ...delegate },
    });
    delegate.identifier = null;
    message.success("委托权限已授予");
  });

const revoke = (delegation: Delegate) =>
  submit(async () => {
    await $fetch("/api/admin/delegations", {
      method: "DELETE",
      body: delegation,
    });
    message.success("委托权限已撤销");
  });

useFetchError(error, loadGroups);
</script>

<template>
  <NCard title="管理授权">
    <NFlex :size="20" vertical>
      <NForm v-if="session?.administrator" @submit.prevent="grant">
        <NFormItem label="授权对象">
          <NRadioGroup v-model:value="delegate.type" @update:value="changeType">
            <NRadioButton value="user">用户</NRadioButton>
            <NRadioButton value="group">群组</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem
          :feedback="
            delegate.type === 'group'
              ? '包含该群组及所有子群组的成员。'
              : undefined
          "
          :label="delegate.type === 'user' ? '用户名或邮箱' : '选择群组'"
        >
          <NInputGroup>
            <UserAutocomplete
              v-if="delegate.type === 'user'"
              v-model:value="delegate.identifier"
              :input-props="{
                id: 'delegate',
                autocomplete: 'off',
                required: true,
              }"
            />
            <GroupSelect
              v-else
              v-model:value="delegate.identifier"
              :groups
              :loading="status === 'pending'"
            />
            <NButton
              attr-type="submit"
              :disabled="!delegate.identifier"
              :loading="pending"
              type="primary"
            >
              授权
            </NButton>
          </NInputGroup>
        </NFormItem>
      </NForm>
      <NList v-if="delegates.length > 0">
        <NListItem
          v-for="item in delegates"
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
              @confirm="revoke(item)"
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
