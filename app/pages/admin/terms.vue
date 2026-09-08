<script setup lang="ts">
import { termStatusLabels } from "#shared/labels";

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error: loadError, refresh } = await useFetch("/api/admin/terms");
const { submit, pending } = useMutation();
const message = useMessage();

const editing = ref<string>();
const label = ref("");
const selected = ref<string[]>([]);

const available = computed(
  () =>
    data.value?.groups.filter(
      (group) =>
        !data.value?.terms.some(
          (term) =>
            term.id !== editing.value &&
            term.groups.some((item) => item.groupId === group.groupId),
        ),
    ) ?? [],
);

const groupLabel = (id: string) =>
  data.value!.groups.find((group) => group.groupId === id)!.label;

function edit(term: NonNullable<typeof data.value>["terms"][number]) {
  editing.value = term.id;
  label.value = term.label;
  selected.value = term.groups.map((group) => group.groupId);
}

function resetForm() {
  editing.value = undefined;
  label.value = "";
  selected.value = [];
}

async function save() {
  const input = {
    label: label.value,
    groupIds: selected.value,
  };

  if (
    await submit(() =>
      editing.value
        ? $fetch(`/api/admin/terms/${editing.value}`, {
            method: "PUT",
            body: input,
          })
        : $fetch("/api/admin/terms", { method: "POST", body: input }),
    )
  ) {
    await refresh();
    resetForm();
    message.success("任期已保存");
  }
}

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="任期配置">
    <NCard v-if="data" title="已有任期">
      <NList v-if="data.terms.length > 0">
        <NListItem v-for="term in data.terms" :key="term.id">
          <NThing>
            <template #header>
              <NFlex align="center">
                <span>{{ term.label }}</span>
                <NTag :bordered="false" size="small">
                  {{ termStatusLabels[term.status] }}
                </NTag>
              </NFlex>
            </template>
            <template #description>
              <NFlex :size="12">
                <NuxtLink
                  v-for="group in term.groups"
                  :key="group.groupId"
                  :to="`/groups/${encodeURIComponent(group.groupId)}`"
                >
                  {{ groupLabel(group.groupId) }}
                </NuxtLink>
              </NFlex>
            </template>
          </NThing>
          <template #suffix>
            <NButton
              v-if="term.status === 'draft'"
              :disabled="pending"
              size="small"
              @click="edit(term)"
            >
              编辑
            </NButton>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else description="尚未建立任期" />
    </NCard>
    <NCard v-if="data" :title="editing ? '编辑任期' : '新建任期'">
      <template #header-extra>
        <NButton v-if="editing" text @click="resetForm()">取消编辑</NButton>
      </template>
      <NForm class="term-form" @submit.prevent="save">
        <NFormItem
          label="任期名称"
          :label-props="{ for: 'term-label' }"
          required
        >
          <NInput
            v-model:value="label"
            :input-props="{ id: 'term-label', required: true }"
            placeholder="例如：2026—2027 学年"
          />
        </NFormItem>
        <NFormItem label="所属群组" required>
          <NSelect
            v-if="available.length > 0"
            v-model:value="selected"
            filterable
            label-field="label"
            multiple
            :options="available"
            placeholder="选择群组"
            value-field="groupId"
          />
          <NEmpty v-else description="暂无可用群组">
            <template #extra>
              <NuxtLink to="/admin">配置群组</NuxtLink>
            </template>
          </NEmpty>
        </NFormItem>
        <NFlex align="center">
          <NButton
            attr-type="submit"
            :disabled="selected.length === 0"
            :loading="pending"
            type="primary"
          >
            保存任期
          </NButton>
          <NText depth="3">已选 {{ selected.length }} 组</NText>
        </NFlex>
      </NForm>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.term-form {
  max-width: 560px;
}
</style>
