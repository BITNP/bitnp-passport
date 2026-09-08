<script setup lang="ts">
const site = useAppConfig();
const { data: session } = await usePortalSession();
useHead({ title: "首页" });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title><h1>网协通行证</h1></template>
    </NPageHeader>
    <NCard size="small">
      <div class="account-content">
        <div class="account-summary">
          <h2>{{ session ? session.user.displayName : "未登录" }}</h2>
          <NText v-if="session" depth="3">
            {{ session.user.username }}
          </NText>
        </div>
        <NFlex align="center" class="account-buttons" :size="16">
          <LinkButton v-if="session" to="/account" type="primary">
            我的账户
          </LinkButton>
          <template v-else>
            <NButton href="/auth/login" tag="a" type="primary">登录</NButton>
            <NButton href="/auth/register" tag="a" text>注册账户</NButton>
          </template>
        </NFlex>
      </div>
    </NCard>
    <section>
      <h2>服务入口</h2>
      <NGrid
        v-if="site.services.length > 0"
        cols="1 s:2 m:3"
        :item-style="{ display: 'flex' }"
        responsive="screen"
        :x-gap="16"
        :y-gap="16"
      >
        <NGi v-for="service in site.services" :key="service.url">
          <NCard
            class="service-link"
            hoverable
            :href="service.url"
            rel="noopener noreferrer"
            size="small"
            tag="a"
            target="_blank"
          >
            <NThing :description="service.description" :title="service.name">
              <template #header-extra>↗</template>
            </NThing>
          </NCard>
        </NGi>
      </NGrid>
      <NCard v-else><NEmpty description="暂无服务" /></NCard>
    </section>
    <NuxtLink to="/help">登录遇到问题？查看帮助</NuxtLink>
  </NuxtLayout>
</template>

<style scoped>
.account-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.account-summary {
  min-width: 0;
}

.account-summary h2 {
  margin: 0;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.account-buttons {
  flex-shrink: 0;
  margin-left: auto;
}

.service-link:hover {
  text-decoration: none;
}

@media (max-width: 640px) {
  .account-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-buttons {
    margin-left: 0;
  }
}
</style>
