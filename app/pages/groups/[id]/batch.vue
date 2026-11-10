<script setup lang="ts">
import type { MembershipPreview } from "#shared/types";

definePageMeta({ middleware: ["auth", "management"] });

const route = useRoute();
const groupId = computed(() => String(route.params.id));
const [
  { data: group, error: loadError, refresh },
  { data: groups, error: groupsError, refresh: refreshGroups },
] = await Promise.all([
  useFetch(() => `/api/groups/${encodeURIComponent(groupId.value)}`),
  useFetch("/api/groups"),
]);
const preview = ref<MembershipPreview>();

useFetchError(groupsError, refreshGroups);
</script>

<template>
  <NuxtLayout
    :back="`/groups/${encodeURIComponent(groupId)}`"
    name="manage"
    title="批量成员操作"
  >
    <template #extra>
      <LinkButton :to="`/jobs?groupId=${encodeURIComponent(groupId)}`">
        群组任务
      </LinkButton>
    </template>
    <template v-if="group" #footer>
      <NuxtLink :to="`/groups/${encodeURIComponent(groupId)}`">
        {{ group.settings ? group.settings.label : group.directory.name }}
      </NuxtLink>
    </template>
    <LoadError v-if="loadError" :error="loadError" :retry="refresh" />
    <GroupBatchInput
      v-if="group"
      :group-id
      :groups
      @preview="preview = $event"
    />
    <GroupBatchPreview v-if="preview" :preview />
    <GroupBatchChanges :group-id :preview />
  </NuxtLayout>
</template>
