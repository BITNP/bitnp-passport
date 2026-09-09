<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const route = useRoute();
const groupId = computed(() => String(route.params.id));

const [{ data: group, error, refresh, status }, { data: session }] =
  await Promise.all([
    useFetch(() => `/api/groups/${encodeURIComponent(groupId.value)}`),
    usePortalSession(),
  ]);

useHead({
  title: () => group.value?.settings.label ?? "群组",
});

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader @back="navigateTo('/groups')">
      <template #title>
        <h1>{{ group?.settings.label || "群组" }}</h1>
      </template>
      <template v-if="group" #extra>
        <NFlex :size="12">
          <LinkButton :to="`/jobs?groupId=${encodeURIComponent(groupId)}`">
            批量任务
          </LinkButton>
          <LinkButton :to="`/audit?groupId=${encodeURIComponent(groupId)}`">
            操作记录
          </LinkButton>
          <LinkButton
            v-if="session?.administrator"
            :to="`/admin?groupId=${encodeURIComponent(groupId)}`"
          >
            配置群组
          </LinkButton>
        </NFlex>
      </template>
      <template #footer>
        <NFlex align="center" justify="space-between" :size="16">
          <NText depth="3">{{ group?.directory.path }}</NText>
          <NFlex v-if="group" :size="20">
            <NuxtLink to="#members">成员</NuxtLink>
            <NuxtLink to="#invitations">邀请链接</NuxtLink>
            <NuxtLink to="#delegations">管理授权</NuxtLink>
          </NFlex>
        </NFlex>
      </template>
    </NPageHeader>
    <template v-if="group">
      <GroupMembers
        id="members"
        class="group-section"
        :group-id
        :loading="status === 'pending'"
        :members="group.members"
        :note="group.settings.note"
        :refresh
        :session
      />
      <InvitationList
        id="invitations"
        :allow-invites="group.settings.allowInvites"
        class="group-section"
        :group-id
      />
      <GroupDelegations
        id="delegations"
        class="group-section"
        :delegates="group.delegates"
        :group-id
        :refresh
        :session
      />
    </template>
  </NuxtLayout>
</template>

<style scoped>
.group-section {
  scroll-margin-top: 80px;
}
</style>
