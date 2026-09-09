<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type TermsData = InternalApi["/api/admin/terms"]["get"];

interface Editor {
  label: string;
  year: number | null;
  rootGroupId: string | null;
  clinicCompatible: boolean;
  groups: { groupId: string | null; code: string; departmentName: string }[];
}

const emit = defineEmits<{ close: [] }>();

const { selection, terms, directory, mutation, refresh } = defineProps<{
  selection: { term?: TermsData["terms"][number] };
  terms: TermsData["terms"];
  mutation: ReturnType<typeof useMutation>;
  refresh: () => Promise<void>;
  directory: {
    groupId: string;
    name: string;
    label: string;
    path: string;
  }[];
}>();

const message = useMessage();
const { submit, pending } = mutation;

const createEditor = (): Editor => ({
  label: selection.term?.label ?? "",
  year: selection.term?.year ?? null,
  rootGroupId: selection.term?.rootGroupId ?? null,
  clinicCompatible: selection.term?.clinicCompatible ?? true,
  groups: structuredClone(toRaw(selection.term?.groups ?? [])),
});

const editor = ref(createEditor());

watch(
  () => selection,
  () => (editor.value = createEditor()),
);

const available = computed(() => {
  const root = directory.find(
    (group) => group.groupId === editor.value.rootGroupId,
  );
  if (!root) {
    return [];
  }
  const assigned = new Set(
    terms
      .filter((item) => item.id !== selection.term?.id)
      .flatMap((item) => item.groups.map((group) => group.groupId)),
  );

  return directory.filter(
    (group) =>
      group.path.startsWith(`${root.path}/`) && !assigned.has(group.groupId),
  );
});

function selectGroup(index: number, groupId: string) {
  const node = directory.find((group) => group.groupId === groupId)!;
  const prefix = `${editor.value.year}-`;
  const displayPrefix = `${editor.value.year} `;

  editor.value.groups[index] = {
    groupId,
    code:
      editor.value.clinicCompatible && node.name.startsWith(prefix)
        ? node.name.slice(prefix.length)
        : node.name,
    departmentName: node.label.startsWith(displayPrefix)
      ? node.label.slice(displayPrefix.length)
      : node.label,
  };
}

const save = () =>
  submit(async () => {
    if (selection.term) {
      await $fetch(`/api/admin/terms/${selection.term.id}`, {
        method: "PUT",
        body: editor.value,
      });
    } else {
      await $fetch("/api/admin/terms", { method: "POST", body: editor.value });
    }

    try {
      await refresh();
      message.success("任期已保存");
    } finally {
      emit("close");
    }
  });
</script>

<template>
  <NCard :title="selection.term ? '编辑任期' : '关联已有群组'">
    <template #header-extra>
      <NButton :disabled="pending" text @click="emit('close')">取消</NButton>
    </template>
    <NForm :disabled="pending" @submit.prevent="save">
      <NGrid cols="1 m:2" responsive="screen" :x-gap="20">
        <NGi>
          <NFormItem label="任期名称" required>
            <NInput
              v-model:value="editor.label"
              :input-props="{ required: true }"
              placeholder="例如：2026 - 2027 学年"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="届别年份（学年起始年）" required>
            <NInputNumber v-model:value="editor.year" :precision="0" />
          </NFormItem>
        </NGi>
      </NGrid>
      <NFormItem label="年度父群组" required>
        <GroupSelect
          v-model:value="editor.rootGroupId"
          :groups="directory"
          @update:value="editor.groups = []"
        />
      </NFormItem>
      <NFormItem>
        <NCheckbox v-model:checked="editor.clinicCompatible">
          兼容现有诊所的年份群组格式
        </NCheckbox>
      </NFormItem>
      <NFormItem label="部门与群组" required>
        <NDynamicInput
          v-model:value="editor.groups"
          :disabled="pending || !editor.rootGroupId"
          :on-create="() => ({ groupId: null, code: '', departmentName: '' })"
        >
          <template #create-button-default>添加部门</template>
          <template #default="{ value, index }">
            <NCard embedded size="small">
              <NGrid cols="1 m:3" responsive="screen" :x-gap="12" :y-gap="12">
                <NGi>
                  <NFormItem label="群组" :show-feedback="false">
                    <GroupSelect
                      :groups="available"
                      :value="value.groupId"
                      @update:value="selectGroup(index, $event)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="部门标识" :show-feedback="false">
                    <NInput
                      v-model:value="value.code"
                      :input-props="{ required: true }"
                      placeholder="例如：clinic"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="部门名称" :show-feedback="false">
                    <NInput
                      v-model:value="value.departmentName"
                      :input-props="{ required: true }"
                      placeholder="例如：电脑诊所"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>
          </template>
        </NDynamicInput>
      </NFormItem>
      <NFlex :size="16" vertical>
        <NText depth="3">部门标识用于对应不同任期的同一部门</NText>
        <NFlex>
          <NButton
            attr-type="submit"
            :disabled="
              editor.year === null ||
              !editor.rootGroupId ||
              editor.groups.length === 0 ||
              editor.groups.some((group) => !group.groupId)
            "
            :loading="pending"
            type="primary"
          >
            保存任期
          </NButton>
          <LinkButton to="/admin">配置群组</LinkButton>
        </NFlex>
      </NFlex>
    </NForm>
  </NCard>
</template>
