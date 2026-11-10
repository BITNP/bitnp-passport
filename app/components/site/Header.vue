<script setup lang="ts">
import type { MenuOption } from "naive-ui";

import { NuxtLink } from "#components";

const {
  data: session,
  error: sessionError,
  refresh: refreshSession,
} = await usePortalSession();
const { submit, pending } = useMutation();
const menuOpen = ref(false);
const route = useRoute();
const active = computed(() => `/${route.path.split("/")[1]}`);

const links = computed(() => [
  ...(session.value ? [{ to: "/account", label: "我的账户" }] : []),
  { to: "/help", label: "帮助" },
]);

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);

const renderLink = (option: MenuOption) =>
  h(NuxtLink, { to: option.to as string }, () => option.label as string);

const signOut = () =>
  submit(async () => {
    const result = await $fetch("/api/logout", { method: "POST" });
    await navigateTo(result.url, { external: true });
  });

useFetchError(sessionError, refreshSession);
</script>

<template>
  <NLayoutHeader bordered class="site-header">
    <div class="header-content">
      <LinkButton size="large" text to="/">
        <NText strong>网协通行证</NText>
      </LinkButton>
      <NMenu
        class="desktop-nav"
        key-field="to"
        mode="horizontal"
        :options="links"
        :render-label="renderLink"
        :value="active"
      />
      <div class="account-actions">
        <LinkButton
          v-if="session?.management"
          size="small"
          to="/manage"
          type="primary"
        >
          管理工作台
        </LinkButton>
        <LinkButton v-if="session?.administrator" size="small" to="/admin">
          系统设置
        </LinkButton>
        <SiteColorModeSwitch />
        <template v-if="session">
          <UserIdentity class="username" to="/account" :user="session.user" />
          <NButton
            class="desktop-only"
            :loading="pending"
            size="small"
            @click="signOut"
          >
            退出
          </NButton>
        </template>
        <template v-else>
          <NButton href="/auth/login" size="small" tag="a" type="primary">
            登录
          </NButton>
          <NButton
            class="desktop-only"
            href="/auth/register"
            size="small"
            tag="a"
          >
            注册
          </NButton>
        </template>
        <NButton
          aria-controls="mobile-nav"
          :aria-expanded="menuOpen"
          class="mobile-menu"
          size="small"
          @click="menuOpen = !menuOpen"
        >
          {{ menuOpen ? "收起" : "菜单" }}
        </NButton>
      </div>
    </div>
    <nav v-if="menuOpen" id="mobile-nav" class="mobile-nav">
      <NMenu
        key-field="to"
        :options="links"
        :render-label="renderLink"
        :value="active"
        @update:value="menuOpen = false"
      />
      <div class="mobile-account">
        <template v-if="session">
          <UserIdentity show-username :user="session.user" />
          <NButton :loading="pending" size="small" @click="signOut">
            退出
          </NButton>
        </template>
        <NButton v-else href="/auth/register" size="small" tag="a">
          注册
        </NButton>
      </div>
    </nav>
  </NLayoutHeader>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1120px;
  min-height: 56px;
  padding: 0 28px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 40px;
}

.desktop-nav {
  width: auto;
  flex-shrink: 0;
}

.account-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-left: auto;
}

.username {
  max-width: 152px;
}

.mobile-menu,
.mobile-nav {
  display: none;
}

.mobile-nav {
  flex-direction: column;
  gap: 8px;
  padding: 0 4px 12px;
}

.mobile-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 12px 16px 0;
  border-top: 1px solid var(--divider-color);
}

@media (max-width: 960px) {
  .header-content {
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 48px;
  }

  .account-actions {
    gap: 8px;
    max-width: 100%;
  }

  .desktop-nav,
  .username,
  .desktop-only {
    display: none;
  }

  .mobile-menu {
    display: inline-flex;
  }

  .mobile-nav {
    display: flex;
  }
}
</style>
