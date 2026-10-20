<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { roleLabel } from "#shared/identity";

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error, refresh } = await useFetch("/api/admin/handover");
const { submit, pending } = useMutation();
const message = useMessage();

const year = ref(new Date().getFullYear() + 1);
const previousRootId = ref<string | null>(null);
const nextRootId = ref<string | null>(null);
const roster = ref<{ role: string; current: string[]; next: string[] }[]>([]);
const preview = ref<InternalApi["/api/admin/handover/preview"]["post"] | null>(
  null,
);
const candidate = reactive<Record<string, string | null>>({});
const chosenUsers = reactive<Record<string, string>>({});

const addCandidate = (role: string) =>
  submit(async () => {
    const user = await $fetch("/api/admin/user-lookup", {
      query: { identifier: candidate[role] },
    });

    const position = roster.value.find((position) => position.role === role)!;
    position.next = [...new Set([...position.next, user.id])];
    chosenUsers[user.id] = user.username;
    candidate[role] = null;
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
  roster.value = data.value.appointments.map((position) => ({
    role: position.role,
    current: position.users.map((user) => user.id),
    next: roster.value.find((item) => item.role === position.role)?.next ?? [],
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

const payload = () => ({
  previousRootId: previousRootId.value!,
  nextRootId: nextRootId.value!,
  appointments: roster.value,
});

const prepare = () =>
  submit(async () => {
    preview.value = await $fetch<
      InternalApi["/api/admin/handover/preview"]["post"]
    >("/api/admin/handover/preview", {
      method: "POST",
      body: payload(),
    });
  });

const execute = () =>
  submit(async () => {
    const job = await $fetch("/api/admin/handover", {
      method: "POST",
      body: payload(),
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

const userLabel = (id: string) =>
  data.value?.appointments
    .flatMap((position) => position.users)
    .find((user) => user.id === id)?.username ??
  chosenUsers[id] ??
  id;

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
          未识别到当前届组织。请确认当前届四个部门组都已配置成员角色映射；
          在补齐前，非管理员部门管理者将无法管理群组。也可在下方选择前届和新届，
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
            :options
            placeholder="选择前届"
          />
        </NFormItem>
        <NFormItem label="新届组织">
          <NSelect v-model:value="nextRootId" :options placeholder="选择新届" />
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
                v-for="user in data?.appointments.find(
                  (item) => item.role === position.role,
                )?.users ?? []"
                :key="user.id"
                :disabled="
                  !user.enabled || position.next.includes(user.id) || pending
                "
                size="small"
                @click="position.next = [...position.next, user.id]"
              >
                {{ user.username }}
              </NButton>
            </NFlex>
            <NText depth="3">新届安排：</NText>
            <NFlex :size="8" wrap>
              <NTag
                v-for="subject in position.next"
                :key="subject"
                closable
                @close="
                  position.next = position.next.filter((id) => id !== subject)
                "
              >
                {{ userLabel(subject) }}
              </NTag>
              <NText v-if="position.next.length === 0" depth="3">空缺</NText>
            </NFlex>
            <NInputGroup>
              <UserAutocomplete
                :value="candidate[position.role] ?? null"
                @update:value="candidate[position.role] = $event"
              />
              <NButton
                :disabled="!candidate[position.role] || pending"
                @click="addCandidate(position.role)"
              >
                加入名单
              </NButton>
            </NInputGroup>
          </NFlex>
        </NCard>
        <NButton
          :disabled="!previousRootId || !nextRootId"
          :loading="pending"
          type="primary"
          @click="prepare"
        >
          查看换届影响
        </NButton>
      </NFlex>
    </NCard>
    <NCard v-if="preview" title="确认换届影响">
      <NFlex :size="16" vertical>
        <NText>{{ preview.previous.path }} → {{ preview.next.path }}</NText>
        <NText>将关闭前届 {{ preview.invitationCount }} 条邀请。</NText>
        <NList>
          <NListItem
            v-for="change in preview.changes"
            :key="`${change.subject}:${change.role}`"
          >
            {{ change.assigned ? "任命" : "离任" }}
            {{ change.preview.user.username }}：{{ roleLabel(change.role) }}
            <NText depth="3" tag="div">
              变更后权限：{{
                change.preview.after.map((role) => role.label).join("、") ||
                "无"
              }}
            </NText>
          </NListItem>
        </NList>
        <NAlert type="warning">失败时会保留已完成的变更。</NAlert>
        <NButton :loading="pending" type="primary" @click="execute">
          提交换届任务
        </NButton>
      </NFlex>
    </NCard>
  </NuxtLayout>
</template>
