<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { termStatusLabels } from "#shared/labels";
import { flattenGroups } from "~/utils/groupDirectory";

type Term = InternalApi["/api/admin/terms"]["get"]["terms"][number];

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error: loadError, refresh } = await useFetch("/api/admin/terms");
const mutation = useMutation();
const { submit, pending } = mutation;
const message = useMessage();

const panel = ref<
  | { type: "edit"; term?: Term }
  | { type: "create"; source: Term }
  | { type: "activate"; termId: string }
>();

const groupLabels = computed(
  () =>
    new Map(data.value?.groups.map((group) => [group.groupId, group.label])),
);

const directory = computed(() =>
  data.value ? flattenGroups(data.value.directory, data.value.groups) : [],
);

async function refreshTerms() {
  await refresh();

  return data.value;
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
          <NButton :disabled="pending" @click="panel = { type: 'edit' }">
            关联已有群组
          </NButton>
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
                    @click="panel = { type: 'edit', term }"
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
                    @click="panel = { type: 'create', source: term }"
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

      <NModal
        :close-on-esc="!pending"
        :mask-closable="false"
        :show="Boolean(panel)"
        @update:show="panel = undefined"
      >
        <div
          aria-label="任期配置"
          aria-modal="true"
          class="term-panel"
          role="dialog"
        >
          <TermEditor
            v-if="panel?.type === 'edit'"
            :directory
            :mutation
            :refresh
            :selection="panel"
            :terms="data.terms"
            @close="panel = undefined"
          />
          <TermCreation
            v-else-if="panel?.type === 'create'"
            :directory
            :mutation
            :refresh="refreshTerms"
            :selection="panel"
            @close="panel = undefined"
          />
          <TermActivation
            v-else-if="panel?.type === 'activate'"
            :mutation
            :refresh
            :selection="panel"
            :terms="data.terms"
            @close="panel = undefined"
          />
        </div>
      </NModal>
    </template>
  </NuxtLayout>
</template>

<style scoped>
.term-panel {
  width: min(1080px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  margin: 24px auto;
  overflow: auto;
}
</style>
