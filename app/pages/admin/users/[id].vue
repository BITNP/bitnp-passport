<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const { data, error, refresh } = await useFetch(
  () => `/api/admin/users/${encodeURIComponent(String(route.params.id))}`,
);

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout
    :back="{ path: '/admin/users', query: route.query }"
    name="admin"
    :title="data?.user.username || '用户详情'"
  >
    <NCard>
      <UserSearch />
    </NCard>
    <template v-if="data">
      <NGrid
        class="user-details"
        cols="1 m:5"
        item-responsive
        responsive="screen"
        :x-gap="20"
        :y-gap="20"
      >
        <NGi span="1 m:3">
          <UserProfile :user="data.user" />
        </NGi>
        <NGi span="1 m:2">
          <NCard title="权限信息">
            <UserPermissions
              :permissions="data.permissions"
              viewer-administrator
            />
          </NCard>
        </NGi>
      </NGrid>
      <UserMemberships
        :key="data.user.id"
        :memberships="data.permissions.memberships"
        :refresh
        :user="data.user"
      />
      <UserKeycloakDetails
        :attributes="data.user.attributes"
        :roles="data.roles"
      />
    </template>
  </NuxtLayout>
</template>

<style scoped>
.user-details {
  overflow-wrap: anywhere;
}
</style>
