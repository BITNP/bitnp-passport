<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { HandoverInput } from "#shared/handover";
import type { AppointmentRole } from "#shared/identity";
import { roleLabel } from "#shared/identity";
import type { DirectoryUser } from "#shared/user";
import { userLabel } from "#shared/user";

type HandoverPreview = InternalApi["/api/admin/handover/preview"]["post"];

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error, refresh } = await useFetch("/api/admin/handover");
const { submit, pending } = useMutation();
const message = useMessage();

const year = ref(new Date().getFullYear() + 1);
const previousRootId = ref<string | null>(null);
const nextRootId = ref<string | null>(null);
const roster = ref<
  { role: AppointmentRole; current: DirectoryUser[]; next: DirectoryUser[] }[]
>([]);
const preview = ref<HandoverPreview | null>(null);
const candidate = reactive<Record<string, string | null>>({});

const addCandidate = (position: {
  role: AppointmentRole;
  next: DirectoryUser[];
}) =>
  submit(async () => {
    const user = await $fetch("/api/admin/user-lookup", {
      query: { identifier: candidate[position.role] },
    });

    position.next = [
      ...new Map(
        [...position.next, user].map((item) => [item.id, item]),
      ).values(),
    ];
    candidate[position.role] = null;
  });

const options = computed(
  () =>
    data.value?.roots.map((root) => ({ value: root.id, label: root.path })) ??
    [],
);

function synchronize() {
  if (!data.value) {
    return;
  }

  previousRootId.value ??= data.value.activeRoot?.id ?? null;
  const previous = new Map(
    roster.value.map((position) => [position.role, position.next]),
  );
  roster.value = data.value.appointments.map((position) => ({
    role: position.role,
    current: position.users,
    next: previous.get(position.role) ?? [],
  }));
}

watch(data, synchronize, { immediate: true });
watch(
  [previousRootId, nextRootId, roster],
  () => {
    preview.value = null;
  },
  { deep: true },
);

const handoverInput = computed<HandoverInput | null>(() => {
  const previous = previousRootId.value;
  const next = nextRootId.value;

  if (!previous || !next) {
    return null;
  }

  return {
    previousRootId: previous,
    nextRootId: next,
    appointments: roster.value.map((position) => ({
      role: position.role,
      current: position.current.map((user) => user.id),
      next: position.next.map((user) => user.id),
    })),
  };
});

const prepare = (input: HandoverInput) =>
  submit(async () => {
    preview.value = await $fetch<HandoverPreview>(
      "/api/admin/handover/preview",
      {
        method: "POST",
        body: input,
      },
    );
  });

const execute = (input: HandoverInput) =>
  submit(async () => {
    const job = await $fetch("/api/admin/handover", {
      method: "POST",
      body: input,
    });

    message.success("换届任务已提交");
    await navigateTo(`/jobs/${job.id}`);
  });

const create = () =>
  submit(async () => {
    const created = await $fetch("/api/admin/year-groups", {
      method: "POST",
      body: { year: year.value },
    });

    await refresh();
    nextRootId.value = created.id;
    message.success("新届群组已就绪");
  });

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="组织与任职换届">
    <NCard title="当前组织">
      <NFlex :size="16" vertical>
        <NText v-if="data?.activeRoot">
          当前届：{{ data?.activeRoot?.path }}
        </NText>
        <NAlert v-if="data && !data.activeRoot" type="warning">
          未识别到当前届组织。请确认唯一当前届根组配置了
          bitnp-active；在补齐前，部门管理者将无法管理群组。也可在下方选择前届和新届，
          通过换届建立当前届。
        </NAlert>
        <NInputGroup>
          <NInputNumber v-model:value="year" :max="9999" :min="1000" />
          <NButton :loading="pending" @click="create">准备该届组织</NButton>
        </NInputGroup>
      </NFlex>
    </NCard>
    <NCard title="换届安排">
      <NFlex :size="20" vertical>
        <NFormItem label="前届组织">
          <NSelect
            v-model:value="previousRootId"
            :disabled="pending"
            :options
            placeholder="选择前届"
          />
        </NFormItem>
        <NFormItem label="新届组织">
          <NSelect
            v-model:value="nextRootId"
            :disabled="pending"
            :options
            placeholder="选择新届"
          />
        </NFormItem>
        <NText depth="3">职务任命</NText>
        <NCard
          v-for="position in roster"
          :key="position.role"
          size="small"
          :title="roleLabel(position.role)"
        >
          <NFlex :size="12" vertical>
            <NText depth="3">点击留任：</NText>
            <NFlex :size="8" wrap>
              <NButton
                v-for="user in position.current"
                :key="user.id"
                class="user-choice"
                :disabled="
                  !user.enabled ||
                  user.serviceAccount ||
                  position.next.some((item) => item.id === user.id) ||
                  pending
                "
                size="small"
                @click="position.next = [...position.next, user]"
              >
                {{ userLabel(user) }}
              </NButton>
            </NFlex>
            <NText depth="3">新届安排：</NText>
            <NFlex :size="8" wrap>
              <NTag
                v-for="user in position.next"
                :key="user.id"
                class="user-choice"
                :closable="!pending"
                @close="
                  position.next = position.next.filter(
                    (item) => item.id !== user.id,
                  )
                "
              >
                {{ userLabel(user) }}
              </NTag>
              <NText v-if="position.next.length === 0" depth="3">空缺</NText>
            </NFlex>
            <NInputGroup>
              <UserAutocomplete
                :disabled="pending"
                :value="candidate[position.role] ?? null"
                @update:value="candidate[position.role] = $event"
              />
              <NButton
                :disabled="!candidate[position.role] || pending"
                @click="addCandidate(position)"
              >
                加入名单
              </NButton>
            </NInputGroup>
          </NFlex>
        </NCard>
        <NButton
          :disabled="!handoverInput"
          :loading="pending"
          type="primary"
          @click="handoverInput && prepare(handoverInput)"
        >
          查看换届影响
        </NButton>
      </NFlex>
    </NCard>
    <NCard v-if="preview && handoverInput" title="确认换届影响">
      <NFlex :size="16" vertical>
        <NText>{{ preview.previous.path }} → {{ preview.next.path }}</NText>
        <NText>将关闭前届 {{ preview.invitationCount }} 条邀请。</NText>
        <NText strong>组织映射变化</NText>
        <NList size="small">
          <NListItem
            v-for="change in preview.groupChanges"
            :key="`${change.groupId}:${change.role}`"
          >
            {{ change.label }}
          </NListItem>
        </NList>
        <NText strong>个人任职变化</NText>
        <NList v-if="preview.changes.length > 0">
          <NListItem
            v-for="change in preview.changes"
            :key="`${change.subject}:${change.role}`"
          >
            {{ change.assigned ? "任命" : "离任" }}
            {{ userLabel(change.preview.user) }}：{{ roleLabel(change.role) }}
            <NText depth="3" tag="div">
              变更后权限：{{
                change.preview.after.map((role) => role.label).join("、") ||
                "无"
              }}
            </NText>
          </NListItem>
        </NList>
        <NText v-else depth="3">个人任职无变化。</NText>
        <NAlert type="warning">
          失败时会保留已完成的变更；结果未确认的步骤请先核对。
        </NAlert>
        <NButton
          :loading="pending"
          type="primary"
          @click="execute(handoverInput)"
        >
          提交换届任务
        </NButton>
      </NFlex>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.user-choice {
  height: auto;
  min-height: 28px;
  max-width: 100%;
  padding: 4px 8px;
}

.user-choice :deep(.n-button__content),
.user-choice :deep(.n-tag__content) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
