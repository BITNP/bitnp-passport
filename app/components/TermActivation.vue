<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

const emit = defineEmits<{ close: [] }>();

const { target, terms, pending, submit, refresh } = defineProps<{
  target: { termId: string };
  terms: InternalApi["/api/admin/terms"]["get"]["terms"];
  pending: boolean;
  submit: ReturnType<typeof useMutation>["submit"];
  refresh: () => Promise<InternalApi["/api/admin/terms"]["get"]>;
}>();

const message = useMessage();
const form = reactive<{ previousTermId?: string; delegations: string[] }>({
  delegations: [],
});
const previousOptions = computed(() =>
  terms
    .filter((term) => term.id !== target.termId && !term.creation)
    .map((term) => ({ value: term.id, label: term.label })),
);

const activation = ref<InternalApi["/api/admin/terms/:id/activation"]["get"]>();

const previewActivation = () =>
  submit(async () => {
    activation.value = undefined;
    const preview = await $fetch(
      `/api/admin/terms/${target.termId}/activation`,
      {
        query: { previousTermId: form.previousTermId },
      },
    );
    activation.value = preview;
    form.previousTermId = preview.previous?.id;
    form.delegations = preview.selectedDelegations;
  });

const activate = () =>
  submit(async () => {
    try {
      await $fetch(`/api/admin/terms/${target.termId}/activate`, {
        method: "POST",
        body: form,
      });
      await refreshNuxtData("portal-session");
      message.success("本届任期已启用");
    } finally {
      // 失败后从列表重新打开已保存的换届计划，避免沿用可编辑的旧预览
      emit("close");
      await refresh();
    }
  });

watch(
  () => target,
  (target, previous) => {
    if (target.termId !== previous?.termId) {
      form.previousTermId = undefined;
    }

    return previewActivation();
  },
  { immediate: true },
);
</script>

<template>
  <NCard title="启用本届">
    <template #header-extra>
      <NButton :disabled="pending" text @click="emit('close')">关闭</NButton>
    </template>
    <NFlex :size="20" vertical>
      <NFormItem
        v-if="!terms.some((term) => term.status === 'current')"
        label="替换的旧任期（首次接管已有群组）"
      >
        <NSelect
          clearable
          :disabled="pending || activation?.pending"
          :options="previousOptions"
          placeholder="没有旧任期"
          :value="form.previousTermId ?? null"
          @update:value="
            form.previousTermId = $event ?? undefined;
            previewActivation();
          "
        />
      </NFormItem>
      <template v-if="activation">
        <NDescriptions :column="1" label-placement="left">
          <NDescriptionsItem label="新任期">
            {{ activation.next.label }}
          </NDescriptionsItem>
          <NDescriptionsItem label="旧任期">
            {{ activation.previous?.label ?? "无" }}
          </NDescriptionsItem>
          <NDescriptionsItem label="旧邀请">
            撤销 {{ activation.invitationCount }} 个邀请，并关闭旧组邀请
          </NDescriptionsItem>
          <NDescriptionsItem label="旧管理授权">
            撤销
            {{ activation.revokedDelegationCount }}
            项，选中的授权转移到本届
          </NDescriptionsItem>
        </NDescriptions>
        <NTable :single-line="false">
          <thead>
            <tr>
              <th>现任角色</th>
              <th>群组</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in activation.activeGroups" :key="group.id">
              <td>
                {{
                  activation.removeGroupIds.includes(group.id) ? "移除" : "保留"
                }}
              </td>
              <td>{{ group.path }}</td>
            </tr>
            <tr>
              <td>授予</td>
              <td>{{ activation.addGroup.path }}</td>
            </tr>
          </tbody>
        </NTable>
        <template v-if="activation.transfers.length > 0">
          <NText>选择要转移的管理授权</NText>
          <NCheckboxGroup
            v-model:value="form.delegations"
            :disabled="pending || activation.pending"
          >
            <NFlex :size="12" vertical>
              <NCheckbox
                v-for="transfer in activation.transfers"
                :key="transfer.key"
                :value="transfer.key"
              >
                {{ transfer.subjectLabel }} → {{ transfer.groupLabel }}
              </NCheckbox>
            </NFlex>
          </NCheckboxGroup>
        </template>
        <NAlert
          v-if="activation.blockedBy.length > 0"
          :bordered="false"
          type="warning"
        >
          <NList>
            <NListItem v-for="reason in activation.blockedBy" :key="reason">
              {{ reason }}
            </NListItem>
          </NList>
        </NAlert>
        <NFlex>
          <NButton
            :disabled="activation.blockedBy.length > 0"
            :loading="pending"
            type="primary"
            @click="activate"
          >
            {{ activation.pending ? "继续换届" : "确认启用" }}
          </NButton>
        </NFlex>
      </template>
    </NFlex>
  </NCard>
</template>
