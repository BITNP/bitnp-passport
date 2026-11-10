<script setup lang="ts">
import { userLabel } from "#shared/user";

definePageMeta({ middleware: ["auth", "management"] });

const route = useRoute();
const { data, error, refresh } = await useFetch(
  () => `/api/manage/users/${encodeURIComponent(String(route.params.id))}`,
);
const { data: session } = await usePortalSession();
useHead({ title: () => (data.value ? userLabel(data.value) : "成员资料") });
useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="manage">
    <NPageHeader @back="navigateTo({ path: '/manage', query: route.query })">
      <template #title>
        <h1>{{ data ? userLabel(data) : "成员资料" }}</h1>
      </template>
      <template v-if="session?.administrator && data" #extra>
        <LinkButton
          :to="{
            path: `/admin/users/${encodeURIComponent(data.id)}`,
            query: route.query,
          }"
        >
          账户与授权
        </LinkButton>
      </template>
    </NPageHeader>
    <NCard><UserSearch /></NCard>
    <UserMemberProfile v-if="data" :key="data.id" :refresh :user="data" />
  </NuxtLayout>
</template>
