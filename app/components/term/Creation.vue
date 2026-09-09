<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type TermsData = InternalApi["/api/admin/terms"]["get"];

const emit = defineEmits<{ close: [] }>();

const { selection, directory, mutation, refresh } = defineProps<{
  selection: { source: TermsData["terms"][number] };
  mutation: ReturnType<typeof useMutation>;
  refresh: () => Promise<TermsData | undefined>;
  directory: {
    groupId: string;
    label: string;
    path: string;
    ancestors: string[];
  }[];
}>();

const { submit, pending } = mutation;
const message = useMessage();

function createForm() {
  const { source } = selection;
  const year = source.year + 1;

  return {
    sourceTermId: source.id,
    label: `${year} - ${year + 1} 学年`,
    year: year as number | null,
    clinicCompatible: source.clinicCompatible,
    parentId: directory
      .find((group) => group.groupId === source.rootGroupId)
      ?.ancestors.at(-1),
  };
}

const form = ref(createForm());
const preview = ref<InternalApi["/api/admin/terms/preview-create"]["post"]>();

watch(
  () => selection,
  () => (form.value = createForm()),
);
watch(form, () => (preview.value = undefined), { deep: true });

const previewCreation = () =>
  submit(async () => {
    const result = await $fetch("/api/admin/terms/preview-create", {
      method: "POST",
      body: form.value,
    });
    preview.value = result;
  });

const create = () =>
  submit(async () => {
    try {
      await $fetch("/api/admin/terms/create-from", {
        method: "POST",
        body: form.value,
      });
      message.success("下一届任期和群组已创建");
    } finally {
      // 外部建组失败时也读取草稿，供管理员继续完成创建。
      const updated = await refresh();
      if (updated?.terms.some((term) => term.label === form.value.label)) {
        emit("close");
      }
    }
  });
</script>

<template>
  <NCard title="创建下一届">
    <template #header-extra>
      <NButton :disabled="pending" text @click="emit('close')">取消</NButton>
    </template>
    <NForm :disabled="pending" @submit.prevent="previewCreation">
      <NGrid cols="1 m:2" responsive="screen" :x-gap="20">
        <NGi>
          <NFormItem label="任期名称" required>
            <NInput
              v-model:value="form.label"
              :input-props="{ required: true }"
              placeholder="例如：2026 - 2027 学年"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="届别年份（学年起始年）" required>
            <NInputNumber v-model:value="form.year" :precision="0" />
          </NFormItem>
        </NGi>
      </NGrid>
      <NFormItem label="新年度群组的位置">
        <GroupSelect
          clearable
          :groups="directory"
          placeholder="顶层群组"
          :value="form.parentId ?? null"
          @update:value="form.parentId = $event ?? undefined"
        />
      </NFormItem>
      <NFormItem>
        <NCheckbox v-model:checked="form.clinicCompatible">
          兼容现有诊所的年份群组格式
        </NCheckbox>
      </NFormItem>
      <NFlex :size="16" vertical>
        <NText depth="3">兼容模式生成 active-年份 / 年份-部门标识</NText>
        <NFlex>
          <NButton
            attr-type="submit"
            :disabled="form.year === null"
            :loading="pending"
            type="primary"
          >
            预览群组
          </NButton>
        </NFlex>
      </NFlex>
    </NForm>
    <template v-if="preview">
      <NDivider />
      <NFlex :size="16" vertical>
        <NText>年度父群组：{{ preview.root.path }}</NText>
        <NTable :single-line="false">
          <thead>
            <tr>
              <th>原群组</th>
              <th>新群组路径</th>
              <th>显示名称</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in preview.groups" :key="group.code">
              <td>
                {{
                  directory.find((item) => item.groupId === group.sourceGroupId)
                    ?.label
                }}
              </td>
              <td>{{ group.path }}</td>
              <td>{{ group.label }}</td>
            </tr>
          </tbody>
        </NTable>
        <NFlex>
          <NButton :loading="pending" type="primary" @click="create">
            确认创建
          </NButton>
        </NFlex>
      </NFlex>
    </template>
  </NCard>
</template>
