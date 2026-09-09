<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { GroupNode } from "#shared/types";

type TermsData = InternalApi["/api/admin/terms"]["get"];

const emit = defineEmits<{ close: [] }>();

const { data, selection, pending, submit, refresh } = defineProps<{
  data: TermsData;
  selection: { term?: TermsData["terms"][number]; copy: boolean };
  pending: boolean;
  submit: ReturnType<typeof useMutation>["submit"];
  refresh: () => Promise<TermsData>;
}>();

const message = useMessage();

const groupLabels = computed(
  () => new Map(data.groups.map((group) => [group.groupId, group.label])),
);

const directory = computed(() => {
  const result: {
    groupId: string;
    name: string;
    label: string;
    path: string;
    parentId?: string;
  }[] = [];

  function visit(groups: GroupNode[], parentId?: string) {
    for (const group of groups) {
      result.push({
        groupId: group.id,
        name: group.name,
        label: groupLabels.value.get(group.id) ?? group.name,
        path: group.path,
        parentId,
      });
      visit(group.children, group.id);
    }
  }

  visit(data.directory);

  return result;
});

interface Editor {
  sourceTermId?: string;
  label: string;
  year: number | null;
  rootGroupId: string | null;
  parentId?: string;
  clinicCompatible: boolean;
  groups: { groupId: string | null; code: string; departmentName: string }[];
}

function createEditor(): Editor {
  const { term, copy } = selection;
  const form: Editor = {
    label: term?.label ?? "",
    year: term?.year ?? null,
    rootGroupId: term?.rootGroupId ?? null,
    clinicCompatible: term?.clinicCompatible ?? true,
    groups: structuredClone(toRaw(term?.groups ?? [])),
  };

  if (copy) {
    const year = term!.year + 1;
    form.sourceTermId = term!.id;
    form.year = year;
    form.label = `${year} - ${year + 1} 学年`;
    form.parentId = directory.value.find(
      (group) => group.groupId === form.rootGroupId,
    )?.parentId;
  }

  return form;
}

const editor = ref(createEditor());

watch(
  () => selection,
  () => (editor.value = createEditor()),
);

const available = computed(() => {
  const root = directory.value.find(
    (group) => group.groupId === editor.value.rootGroupId,
  );
  if (!root) {
    return [];
  }
  const assigned = new Set(
    data.terms
      .filter((term) => term.id !== selection.term?.id)
      .flatMap((term) => term.groups.map((group) => group.groupId)),
  );

  return directory.value.filter(
    (group) =>
      group.path.startsWith(`${root.path}/`) &&
      groupLabels.value.has(group.groupId) &&
      !assigned.has(group.groupId),
  );
});

function selectGroup(index: number, groupId: string) {
  const node = directory.value.find((group) => group.groupId === groupId)!;
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

const creationPreview =
  ref<InternalApi["/api/admin/terms/preview-create"]["post"]>();

watch(editor, () => (creationPreview.value = undefined), { deep: true });

const save = () =>
  submit(async () => {
    const form = editor.value;
    if (form.sourceTermId) {
      const preview = await $fetch("/api/admin/terms/preview-create", {
        method: "POST",
        body: form,
      });
      creationPreview.value = preview;

      return;
    }

    if (selection.term) {
      await $fetch(`/api/admin/terms/${selection.term.id}`, {
        method: "PUT",
        body: form,
      });
    } else {
      await $fetch("/api/admin/terms", { method: "POST", body: form });
    }

    emit("close");
    await refresh();
    message.success("任期已保存");
  });

const createCopy = () =>
  submit(async () => {
    try {
      await $fetch("/api/admin/terms/create-from", {
        method: "POST",
        body: editor.value,
      });
      message.success("下一届任期和群组已创建");
    } finally {
      // 外部建组失败时也读取草稿，供管理员继续完成创建
      const updated = await refresh();
      if (updated.terms.some((term) => term.label === editor.value.label)) {
        emit("close");
      }
    }
  });
</script>

<template>
  <NCard
    :title="
      editor.sourceTermId
        ? '创建下一届'
        : selection.term
          ? '编辑任期'
          : '关联已有群组'
    "
  >
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
      <NFormItem v-if="editor.sourceTermId" label="新年度群组的位置">
        <GroupSelect
          clearable
          :groups="directory"
          placeholder="顶层群组"
          :value="editor.parentId ?? null"
          @update:value="editor.parentId = $event ?? undefined"
        />
      </NFormItem>
      <NFormItem v-else label="年度父群组" required>
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
      <NFormItem v-if="!editor.sourceTermId" label="部门与群组" required>
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
        <NText v-if="editor.sourceTermId" depth="3">
          兼容模式生成 active-年份 / 年份-部门标识
        </NText>
        <NText v-else depth="3">部门标识用于对应不同任期的同一部门</NText>
        <NFlex>
          <NButton
            attr-type="submit"
            :disabled="
              editor.year === null ||
              (!editor.sourceTermId &&
                (!editor.rootGroupId ||
                  editor.groups.length === 0 ||
                  editor.groups.some((group) => !group.groupId)))
            "
            :loading="pending"
            type="primary"
          >
            {{ editor.sourceTermId ? "预览群组" : "保存任期" }}
          </NButton>
          <LinkButton v-if="!editor.sourceTermId" to="/admin">
            配置群组
          </LinkButton>
        </NFlex>
      </NFlex>
    </NForm>
    <template v-if="creationPreview">
      <NDivider />
      <NFlex :size="16" vertical>
        <NText>年度父群组：{{ creationPreview.root.path }}</NText>
        <NTable :single-line="false">
          <thead>
            <tr>
              <th>原群组</th>
              <th>新群组路径</th>
              <th>显示名称</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in creationPreview.groups" :key="group.code">
              <td>{{ groupLabels.get(group.sourceGroupId) }}</td>
              <td>{{ group.path }}</td>
              <td>{{ group.label }}</td>
            </tr>
          </tbody>
        </NTable>
        <NFlex>
          <NButton :loading="pending" type="primary" @click="createCopy">
            确认创建
          </NButton>
        </NFlex>
      </NFlex>
    </template>
  </NCard>
</template>
