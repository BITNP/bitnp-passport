<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type TermsData = InternalApi["/api/admin/terms"]["get"];
type Department = TermsData["departments"][number];

interface Editor {
  label: string;
  year: number | null;
  rootGroupId: string | null;
  clinicCompatible: boolean;
  groups: { groupId: string | null; code: string | null }[];
}

const emit = defineEmits<{
  close: [];
  departmentCreated: [department: Department];
}>();

const { selection, terms, departments, directory, mutation, refresh } =
  defineProps<{
    selection: { term?: TermsData["terms"][number] };
    terms: TermsData["terms"];
    departments: Department[];
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
  groups:
    selection.term?.groups.map(({ groupId, code }) => ({ groupId, code })) ??
    [],
});

const editor = ref(createEditor());
const newDepartment = ref<{ code: string; name: string }>();

watch(
  () => selection,
  () => {
    editor.value = createEditor();
    newDepartment.value = undefined;
  },
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

function availableGroups(index: number) {
  const selected = new Set(
    editor.value.groups
      .filter((_, row) => row !== index)
      .map((group) => group.groupId),
  );

  return available.value.filter((group) => !selected.has(group.groupId));
}

function departmentOptions(index: number) {
  const selected = new Set(
    editor.value.groups
      .filter((_, row) => row !== index)
      .map((group) => group.code),
  );

  return departments.map((department) => ({
    label: department.name,
    value: department.code,
    disabled: selected.has(department.code),
  }));
}

function selectGroup(index: number, groupId: string) {
  const node = directory.find((group) => group.groupId === groupId)!;
  const prefix = `${editor.value.year}-`;
  const code =
    editor.value.clinicCompatible && node.name.startsWith(prefix)
      ? node.name.slice(prefix.length)
      : node.name;
  const matched = departments.some((department) => department.code === code);
  const selected = editor.value.groups.some(
    (group, row) => row !== index && group.code === code,
  );

  editor.value.groups[index] = {
    groupId,
    code: matched && !selected ? code : null,
  };
}

const canSave = computed(() => {
  const { label, year, rootGroupId, groups } = editor.value;

  return (
    !newDepartment.value &&
    label.trim().length > 0 &&
    year !== null &&
    rootGroupId !== null &&
    groups.length > 0 &&
    groups.every((group) => group.groupId && group.code) &&
    new Set(groups.map((group) => group.groupId)).size === groups.length &&
    new Set(groups.map((group) => group.code)).size === groups.length
  );
});

function createDepartment() {
  if (!newDepartment.value?.code.trim() || !newDepartment.value.name.trim()) {
    return;
  }
  const body = { ...newDepartment.value };

  return submit(async () => {
    const department = await $fetch("/api/admin/departments", {
      method: "POST",
      body,
    });
    emit("departmentCreated", department);
    newDepartment.value = undefined;
    message.success("部门已建立，可在各届任期中选择");
  });
}

function save() {
  if (!canSave.value) {
    return;
  }

  return submit(async () => {
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
}
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
          :on-create="() => ({ groupId: null, code: null })"
        >
          <template #create-button-default>添加关联</template>
          <template #default="{ value, index }">
            <NCard embedded size="small">
              <NGrid cols="1 m:2" responsive="screen" :x-gap="12" :y-gap="12">
                <NGi>
                  <NFormItem label="群组" :show-feedback="false">
                    <GroupSelect
                      :groups="availableGroups(index)"
                      :value="value.groupId"
                      @update:value="selectGroup(index, $event)"
                    />
                  </NFormItem>
                </NGi>
                <NGi>
                  <NFormItem label="部门" :show-feedback="false">
                    <NSelect
                      v-model:value="value.code"
                      filterable
                      :options="departmentOptions(index)"
                      placeholder="选择已有部门"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NCard>
          </template>
        </NDynamicInput>
      </NFormItem>
      <NFlex :size="16" vertical>
        <NFlex align="center" justify="space-between">
          <NButton
            v-if="!newDepartment"
            :disabled="pending"
            @click="newDepartment = { code: '', name: '' }"
          >
            新增部门
          </NButton>
        </NFlex>
        <NCard
          v-if="newDepartment"
          embedded
          size="small"
          title="新增部门"
          @keydown.enter.prevent.stop="createDepartment"
        >
          <NGrid cols="1 m:2" responsive="screen" :x-gap="12">
            <NGi>
              <NFormItem label="部门名称" required>
                <NInput
                  v-model:value="newDepartment.name"
                  placeholder="例如：电脑诊所"
                />
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem label="固定标识" required>
                <NInput
                  v-model:value="newDepartment.code"
                  placeholder="例如：clinic，不带年份"
                />
              </NFormItem>
            </NGi>
          </NGrid>
          <NFlex :size="12" vertical>
            <NFlex>
              <NButton
                :disabled="
                  !newDepartment.name.trim() || !newDepartment.code.trim()
                "
                :loading="pending"
                type="primary"
                @click="createDepartment"
              >
                建立部门
              </NButton>
              <NButton :disabled="pending" @click="newDepartment = undefined">
                取消新增
              </NButton>
            </NFlex>
          </NFlex>
        </NCard>
        <NFlex>
          <NButton
            attr-type="submit"
            :disabled="!canSave"
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
