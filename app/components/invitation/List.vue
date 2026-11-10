<script setup lang="ts">
import type {
  CreateInvitationInput,
  UpdateInvitationInput,
} from "#shared/invitations";
import { formatDateTime } from "#shared/utils";

const { groupId, allowInvites } = defineProps<{
  groupId: string;
  allowInvites: boolean;
}>();

const endpoint = computed(
  () => `/api/groups/${encodeURIComponent(groupId)}/invitations` as const,
);
const { data: invitations, error, refresh, status } = await useFetch(endpoint);
const { submit, pending, running } = useMutation();
const message = useMessage();
const form = ref<CreateInvitationInput>({
  days: 7,
  note: "",
  allowRegistration: false,
});
const renewalDays = ref<number | null>(7);
const editor = ref<UpdateInvitationInput>();
const usageId = ref<string>();
const usageInvitation = computed(() =>
  invitations.value?.find((invitation) => invitation.id === usageId.value),
);

const durations = [1, 7, 14, 30].map((value) => ({
  label: `${value} 天`,
  value,
}));

type Invitation = NonNullable<typeof invitations.value>[number];

function invitationState(invitation: Invitation) {
  if (invitation.revokedAt) {
    return { label: "已撤销", type: "default", usable: false } as const;
  }

  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return { label: "已过期", type: "warning", usable: false } as const;
  }

  return { label: "有效", type: "success", usable: true } as const;
}

const createInvitation = () =>
  submit(async () => {
    await $fetch(endpoint.value, {
      method: "POST",
      body: form.value,
    });
    form.value = { days: form.value.days, note: "", allowRegistration: false };
    message.success("邀请已创建");
    await refresh();
  }, "create");

const updateInvitation = () =>
  submit(async () => {
    await $fetch(endpoint.value, {
      method: "PUT",
      body: editor.value!,
    });
    editor.value = undefined;
    message.success("邀请设置已保存");
    await refresh();
  }, "update");

const renewInvitation = (id: string) =>
  submit(async () => {
    await $fetch(endpoint.value, {
      method: "PATCH",
      body: { id, days: renewalDays.value },
    });
    message.success("邀请已续期");
    await refresh();
  }, `renew:${id}`);

const revokeInvitation = (id: string) =>
  submit(async () => {
    await $fetch(endpoint.value, { method: "DELETE", body: { id } });
    message.success("邀请已撤销");
    await refresh();
  }, `revoke:${id}`);

async function copyInvitation(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    message.success("链接已复制");
  } catch {
    message.error("无法写入剪贴板，请手动选中链接复制");
  }
}
</script>

<template>
  <NCard title="邀请链接">
    <NFlex :size="20" vertical>
      <NForm v-if="allowInvites" @submit.prevent="createInvitation">
        <NFlex :size="16" vertical>
          <NFlex align="end" :size="12">
            <NFormItem label="备注（可选）" :show-feedback="false">
              <NInput
                v-model:value="form.note"
                clearable
                placeholder="填写备注"
              />
            </NFormItem>
            <NFormItem label="有效期" :show-feedback="false">
              <NSelect
                v-model:value="form.days"
                class="duration-select"
                :options="durations"
              />
            </NFormItem>
          </NFlex>
          <NCheckbox
            v-model:checked="form.allowRegistration"
            :disabled="pending"
          >
            允许新用户注册
          </NCheckbox>
          <NFlex>
            <NButton
              attr-type="submit"
              :disabled="pending"
              :loading="running === 'create'"
              type="primary"
            >
              创建邀请
            </NButton>
          </NFlex>
        </NFlex>
      </NForm>
      <NText v-else depth="3">此群组未开放邀请</NText>
      <NSpin :show="status === 'pending'">
        <NList v-if="invitations?.length" show-divider>
          <NListItem v-for="invitation in invitations" :key="invitation.id">
            <NFlex :size="12" vertical>
              <NFlex align="center" justify="space-between" :size="12">
                <NFlex align="center" :size="8">
                  <NText v-if="invitation.note" strong>
                    {{ invitation.note }}
                  </NText>
                  <NText v-else depth="3">未填写备注</NText>
                  <NTag
                    :bordered="false"
                    size="small"
                    :type="invitationState(invitation).type"
                  >
                    {{ invitationState(invitation).label }}
                  </NTag>
                  <NTag :bordered="false" size="small">
                    {{
                      invitation.allowRegistration
                        ? "可注册新账号"
                        : "使用已有账号"
                    }}
                  </NTag>
                </NFlex>
                <NButton
                  :disabled="pending"
                  size="small"
                  text
                  @click="
                    editor = {
                      id: invitation.id,
                      note: invitation.note,
                      allowRegistration: invitation.allowRegistration,
                    }
                  "
                >
                  编辑设置
                </NButton>
              </NFlex>
              <NInputGroup v-if="invitationState(invitation).usable">
                <NInput
                  readonly
                  :value="invitation.url"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <NButton @click="copyInvitation(invitation.url)">复制</NButton>
              </NInputGroup>
              <NFlex align="center" justify="space-between" :size="12">
                <NFlex :size="12">
                  <NText depth="3">
                    创建：{{ formatDateTime(invitation.createdAt) }}
                  </NText>
                  <NText depth="3">
                    到期：{{ formatDateTime(invitation.expiresAt) }}
                  </NText>
                  <NText v-if="invitation.revokedAt" depth="3">
                    撤销：{{ formatDateTime(invitation.revokedAt) }}
                  </NText>
                </NFlex>
                <NFlex align="center" :size="8">
                  <NButton size="small" @click="usageId = invitation.id">
                    使用记录
                  </NButton>
                  <template v-if="!invitation.revokedAt">
                    <NPopconfirm
                      v-if="allowInvites"
                      :disabled="pending"
                      negative-text="取消"
                      :positive-button-props="{
                        disabled: pending || renewalDays === null,
                      }"
                      positive-text="续期"
                      :show-icon="false"
                      @positive-click="renewInvitation(invitation.id)"
                    >
                      <template #trigger>
                        <NButton
                          :disabled="pending"
                          :loading="running === `renew:${invitation.id}`"
                          size="small"
                        >
                          续期
                        </NButton>
                      </template>

                      <NFormItem label="延长天数" :show-feedback="false">
                        <NInputNumber
                          v-model:value="renewalDays"
                          class="duration-select"
                          :max="30"
                          :min="1"
                          :precision="0"
                        />
                      </NFormItem>
                    </NPopconfirm>
                    <ConfirmAction
                      :disabled="pending"
                      message="确认撤销此邀请？"
                      @confirm="revokeInvitation(invitation.id)"
                    >
                      撤销
                    </ConfirmAction>
                  </template>
                </NFlex>
              </NFlex>
            </NFlex>
          </NListItem>
        </NList>
        <LoadError v-else-if="error" :error :retry="refresh" />
        <NEmpty v-else-if="status === 'success'" description="暂无邀请链接" />
      </NSpin>
    </NFlex>
    <NModal
      preset="dialog"
      :show="Boolean(editor)"
      :show-icon="false"
      title="编辑邀请"
      @update:show="editor = undefined"
    >
      <NFlex v-if="editor" :size="16" vertical>
        <NFormItem
          label="备注"
          :label-props="{ for: 'invitation-note' }"
          :show-feedback="false"
        >
          <NInput
            v-model:value="editor.note"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :input-props="{ id: 'invitation-note' }"
            type="textarea"
          />
        </NFormItem>
        <NCheckbox
          v-model:checked="editor.allowRegistration"
          :disabled="pending"
        >
          允许新用户注册
        </NCheckbox>
      </NFlex>
      <template #action>
        <NButton :disabled="pending" @click="editor = undefined">取消</NButton>
        <NButton
          :loading="running === 'update'"
          type="primary"
          @click="updateInvitation"
        >
          保存
        </NButton>
      </template>
    </NModal>
    <NDrawer
      :show="Boolean(usageInvitation)"
      width="min(680px, 100vw)"
      @update:show="usageId = undefined"
    >
      <InvitationUses
        v-if="usageInvitation"
        :key="usageInvitation.id"
        :group-id
        :invitation="usageInvitation"
      />
    </NDrawer>
  </NCard>
</template>

<style scoped>
.duration-select {
  width: 140px;
}
</style>
