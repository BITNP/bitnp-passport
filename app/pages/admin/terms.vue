<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { termStatusLabels } from "#shared/labels";

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error: loadError, refresh } = await useFetch("/api/admin/terms");
const { submit, pending } = useMutation();
const message = useMessage();

type Term = InternalApi["/api/admin/terms"]["get"]["terms"][number];

const panel = ref<
  | { type: "edit"; term?: Term; copy: boolean }
  | { type: "activate"; termId: string }
>();

const groupLabels = computed(
  () =>
    new Map(data.value?.groups.map((group) => [group.groupId, group.label])),
);

async function refreshTerms() {
  await refresh();

  return data.value!;
}

function edit(term?: Term, copy = false) {
  panel.value = { type: "edit", term, copy };
}

const resumeCreation = (id: string) =>
  submit(async () => {
    try {
      await $fetch(`/api/admin/terms/${id}/provision`, { method: "POST" });
      message.success("任期群组已创建");
    } finally {
      await refresh();
    }
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="任期配置">
    <template v-if="data">
      <NCard title="已有任期">
        <template #header-extra>
          <NButton :disabled="pending" @click="edit()">关联已有群组</NButton>
        </template>
        <NList v-if="data.terms.length > 0">
          <NListItem v-for="term in data.terms" :key="term.id">
            <NThing>
              <template #header>
                <NFlex align="center" :size="8">
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
                    {{ groupLabels.get(group.groupId) }}
                  </NuxtLink>
                </NFlex>
              </template>
            </NThing>
            <template #suffix>
              <NFlex :size="8">
                <NButton
                  v-if="term.creation"
                  :loading="pending"
                  size="small"
                  @click="resumeCreation(term.id)"
                >
                  继续创建
                </NButton>
                <template v-else>
                  <NButton
                    v-if="term.status === 'draft' && !term.activation"
                    :disabled="pending"
                    size="small"
                    @click="edit(term)"
                  >
                    编辑
                  </NButton>
                  <NButton
                    v-if="term.status === 'draft'"
                    :disabled="pending"
                    size="small"
                    @click="panel = { type: 'activate', termId: term.id }"
                  >
                    {{ term.activation ? "继续换届" : "启用本届" }}
                  </NButton>
                  <NButton
                    :disabled="pending || term.activation"
                    size="small"
                    @click="edit(term, true)"
                  >
                    创建下一届
                  </NButton>
                </template>
              </NFlex>
            </template>
          </NListItem>
        </NList>
        <NEmpty v-else description="尚未建立任期" />
      </NCard>

      <TermEditor
        v-if="panel?.type === 'edit'"
        :data
        :pending
        :refresh="refreshTerms"
        :selection="panel"
        :submit
        @close="panel = undefined"
      />
      <TermActivation
        v-else-if="panel?.type === 'activate'"
        :pending
        :refresh="refreshTerms"
        :submit
        :target="panel"
        :terms="data.terms"
        @close="panel = undefined"
      />
    </template>
  </NuxtLayout>
</template>
