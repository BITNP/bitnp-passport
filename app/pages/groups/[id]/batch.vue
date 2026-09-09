<script setup lang="ts">
import type { MembershipPreview } from "#shared/types";

definePageMeta({ middleware: "auth" });
useHead({ title: "批量成员操作" });

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

useFetchError(loadError, refresh);
useFetchError(groupsError, refreshGroups);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader @back="navigateTo(`/groups/${encodeURIComponent(groupId)}`)">
      <template #title><h1>批量成员操作</h1></template>
      <template v-if="group" #footer>
        <NuxtLink :to="`/groups/${encodeURIComponent(groupId)}`">
          {{ group.settings.label }}
        </NuxtLink>
      </template>
      <template #extra>
        <LinkButton :to="`/jobs?groupId=${encodeURIComponent(groupId)}`">
          群组任务
        </LinkButton>
      </template>
    </NPageHeader>
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
