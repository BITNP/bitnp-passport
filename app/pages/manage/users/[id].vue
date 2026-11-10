<script setup lang="ts">
import { userLabel } from "#shared/user";

definePageMeta({ middleware: ["auth", "management"] });

const route = useRoute();
const { data, error, refresh } = await useFetch(
  () => `/api/manage/users/${encodeURIComponent(String(route.params.id))}`,
);
useHead({
  title: () => (data.value ? userLabel(data.value.user) : "成员资料"),
});
</script>

<template>
  <NuxtLayout name="manage">
    <NPageHeader @back="navigateBack({ path: '/manage', query: route.query })">
      <template #title>
        <h1>{{ data ? userLabel(data.user) : "成员资料" }}</h1>
      </template>
    </NPageHeader>
    <NCard><UserSearch /></NCard>
    <LoadError v-if="error" :error :retry="refresh" />
    <template v-if="data">
      <template v-if="data.administration">
        <NGrid
          class="user-details"
          cols="1 m:5"
          item-responsive
          responsive="screen"
          :x-gap="20"
          :y-gap="20"
        >
          <NGi span="1 m:3">
            <UserProfile :key="data.user.id" :refresh :user="data.user" />
          </NGi>
          <NGi span="1 m:2">
            <NCard title="权限信息">
              <UserPermissions
                :permissions="data.administration.permissions"
                viewer-administrator
              />
            </NCard>
          </NGi>
        </NGrid>
        <UserMemberships
          :key="data.user.id"
          :memberships="data.administration.permissions.memberships"
          :refresh
          :user="data.user"
        />
        <UserAssignments
          :key="data.user.id"
          :direct-roles="data.administration.directRoles"
          :refresh
          :user="data.user"
        />
        <UserKeycloakDetails
          :attributes="data.administration.attributes"
          :roles="data.administration.roles"
        />
      </template>
      <UserMemberProfile
        v-else
        :key="data.user.id"
        :refresh
        :user="data.user"
      />
    </template>
  </NuxtLayout>
</template>

<style scoped>
.user-details {
  overflow-wrap: anywhere;
}
</style>
