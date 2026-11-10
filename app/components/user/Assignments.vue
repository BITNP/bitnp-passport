<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import {
  appointmentRoles,
  roleLabel,
  systemAdministratorRole,
} from "#shared/identity";
import type { DirectoryUser } from "#shared/user";
import { userLabel } from "#shared/user";

const { user, directRoles, refresh } = defineProps<{
  user: DirectoryUser;
  directRoles: string[];
  refresh: () => Promise<void>;
}>();

const options = [...appointmentRoles, systemAdministratorRole].map((role) => ({
  value: role,
  label: role === systemAdministratorRole ? "个人系统授权" : roleLabel(role),
}));
const optionLabel = (role: string) =>
  options.find((option) => option.value === role)?.label ?? roleLabel(role);
const assignedOptions = computed(() =>
  options.filter((option) => directRoles.includes(option.value)),
);
const availableOptions = computed(() =>
  options.filter((option) => !directRoles.includes(option.value)),
);

const selected = ref<string | null>(null);
const preview = ref<
  InternalApi["/api/admin/users/:id/roles/preview"]["post"] | null
>(null);

const { submit, pending, running } = useMutation();
const message = useMessage();
const { data: session } = await usePortalSession();
const api = computed(
  () => `/api/admin/users/${encodeURIComponent(user.id)}/roles` as const,
);

const prepare = (role: string, assigned: boolean) =>
  submit(
    async () => {
      preview.value = await $fetch<
        InternalApi["/api/admin/users/:id/roles/preview"]["post"]
      >(`${api.value}/preview`, {
        method: "POST",
        body: {
          role,
          assigned,
          previouslyAssigned: directRoles.includes(role),
        },
      });
    },
    assigned ? "grant" : `revoke:${role}`,
  );

const confirm = () =>
  submit(async () => {
    const { role, assigned, previouslyAssigned } = preview.value!;
    await $fetch(api.value, {
      method: "POST",
      body: { role, assigned, previouslyAssigned },
    });

    preview.value = null;
    selected.value = null;
    message.success("授权已更新");

    await refreshNuxtData("portal-session");

    if (session.value?.user.id === user.id && !session.value.administrator) {
      await navigateTo("/account");
    } else {
      await refresh();
    }
  }, "confirm");
</script>

<template>
  <NCard title="个人任职与授权">
    <NFlex :size="16" vertical>
      <NInputGroup>
        <NSelect
          v-model:value="selected"
          :disabled="pending || !user.enabled"
          :options="availableOptions"
          placeholder="选择职务或个人系统授权"
        />
        <NButton
          :disabled="!selected || pending || !user.enabled"
          :loading="running === 'grant'"
          type="primary"
          @click="prepare(selected!, true)"
        >
          授予
        </NButton>
      </NInputGroup>
      <NList v-if="assignedOptions.length > 0">
        <NListItem v-for="option in assignedOptions" :key="option.value">
          {{ option.label }}
          <template #suffix>
            <NButton
              :disabled="pending"
              :loading="running === `revoke:${option.value}`"
              size="small"
              @click="prepare(option.value, false)"
            >
              撤销
            </NButton>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else description="暂无个人任职或授权" />
    </NFlex>
    <NModal
      class="assignment-modal"
      preset="card"
      :show="preview !== null"
      title="确认授权变化"
      @update:show="!$event && (preview = null)"
    >
      <NFlex v-if="preview" :size="16" vertical>
        <NText>
          {{ userLabel(preview.user) }}：{{
            preview.assigned ? "授予" : "撤销"
          }}
          {{ optionLabel(preview.role) }}
        </NText>
        <NAlert v-if="preview.role === systemAdministratorRole" type="warning">
          此授权不随换届变更。
        </NAlert>
        <NDescriptions :column="1" label-placement="top">
          <NDescriptionsItem label="变更前权限">
            {{ preview.before.map((role) => role.label).join("、") || "无" }}
          </NDescriptionsItem>
          <NDescriptionsItem label="变更后权限">
            <NFlex :size="8" vertical>
              <div v-for="role in preview.after" :key="role.name">
                {{ role.label }}：{{
                  role.sources.map((source) => source.label).join("、")
                }}
              </div>
              <NText v-if="preview.after.length === 0">无</NText>
            </NFlex>
          </NDescriptionsItem>
        </NDescriptions>
        <NFlex justify="end" :size="8">
          <NButton :disabled="pending" @click="preview = null">取消</NButton>
          <NButton
            :loading="running === 'confirm'"
            :type="preview.assigned ? 'primary' : 'error'"
            @click="confirm"
          >
            确认{{ preview.assigned ? "授予" : "撤销" }}
          </NButton>
        </NFlex>
      </NFlex>
    </NModal>
  </NCard>
</template>

<style scoped>
.assignment-modal {
  width: min(680px, 92vw);
}
</style>
