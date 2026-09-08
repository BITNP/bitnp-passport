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

const links = computed(() => {
  const items = [];

  if (session.value) {
    items.push(
      { to: "/account", label: "我的账户" },
      { to: "/groups", label: "群组" },
      { to: "/jobs", label: "任务" },
      { to: "/audit", label: "记录" },
    );
  }

  items.push({ to: "/help", label: "帮助" });

  return items;
});

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
          v-if="session?.administrator"
          size="small"
          to="/admin"
          type="primary"
          @click="menuOpen = false"
        >
          管理后台
        </LinkButton>
        <ColorModeSwitch />
        <template v-if="session">
          <NuxtLink class="username" to="/account">
            <NButton size="small" tag="span" text>
              <NEllipsis class="username-text">
                {{ session.user.displayName }}
              </NEllipsis>
            </NButton>
          </NuxtLink>
          <NButton :loading="pending" size="small" @click="signOut">
            退出
          </NButton>
        </template>
        <template v-else>
          <NButton href="/auth/login" size="small" tag="a" type="primary">
            登录
          </NButton>
          <NButton href="/auth/register" size="small" tag="a">注册</NButton>
        </template>
        <NButton class="mobile-menu" size="small" @click="menuOpen = !menuOpen">
          {{ menuOpen ? "收起" : "菜单" }}
        </NButton>
      </div>
    </div>
    <NMenu
      v-if="menuOpen"
      class="mobile-nav"
      key-field="to"
      mode="horizontal"
      :options="links"
      :render-label="renderLink"
      :value="active"
      @update:value="menuOpen = false"
    />
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
  gap: 12px;
  align-items: center;
  margin-left: auto;
}

.username-text {
  max-width: 120px;
}

.mobile-menu,
.mobile-nav {
  display: none;
}

.mobile-nav {
  flex-wrap: wrap;
  padding: 0 12px 12px;
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
  }

  .desktop-nav,
  .username {
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
