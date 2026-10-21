<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const [{ data: account, error, refresh }, { data: session }] =
  await Promise.all([useFetch("/api/account"), usePortalSession()]);

useFetchError(error, refresh);

function applyAvatar(avatarUrl: string | null) {
  if (account.value) {
    account.value = { ...account.value, avatarUrl };
  }
}
</script>

<template>
  <NuxtLayout name="account" title="我的账户">
    <NGrid
      v-if="account"
      cols="1 m:3"
      item-responsive
      responsive="screen"
      :x-gap="20"
      :y-gap="20"
    >
      <NGi span="1 m:2">
        <NFlex :size="20" vertical>
          <AccountAvatar
            :avatar-url="account.avatarUrl"
            :profile="account.profile"
            @updated="applyAvatar"
          />
          <AccountProfileForm
            :profile="account.profile"
            @saved="account = { ...account, profile: $event }"
          />
        </NFlex>
      </NGi>
      <NGi>
        <NCard title="权限信息">
          <UserPermissions
            :permissions="account.permissions"
            :viewer-administrator="session?.administrator ?? false"
          />
        </NCard>
      </NGi>
    </NGrid>
  </NuxtLayout>
</template>
