<script setup lang="ts">
const [{ data: site, error, refresh, status }, { data: session }] =
  await Promise.all([
    useFetch("/api/site", { key: "site-settings" }),
    usePortalSession(),
  ]);

useFetchError(error, refresh);
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
    <NGrid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard class="notice-card" size="small" title="北理工公众用户">
          <p>
            网协通行证暂不对北理工公众用户提供服务。电脑诊所的对外预约服务，请通过校微信企业号「网络服务
            → 电脑义诊」访问。
          </p>
          <template #footer>
            <NButton href="https://weixin.info.bit.edu.cn/" tag="a">
              关注企业号
            </NButton>
          </template>
        </NCard>
      </NGi>
      <NGi>
        <NCard class="notice-card" size="small" title="网协成员">
          <p>没有账户？请优先使用管理层发送的邀请链接，注册后加入相应群组。</p>
          <p>登录遇到问题？可自助重置密码，或联系技术保障中心人工处理。</p>
          <template #footer>
            <LinkButton to="/help">登录帮助</LinkButton>
          </template>
        </NCard>
      </NGi>
    </NGrid>
    <section>
      <h2>服务入口</h2>
      <template v-if="site">
        <NGrid
          v-if="site.services.length > 0"
          cols="1 s:2 m:3"
          responsive="screen"
          :x-gap="16"
          :y-gap="16"
        >
          <NGi v-for="(service, index) in site.services" :key="index">
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
      </template>
      <NCard v-else-if="status === 'pending'">
        <NSkeleton :repeat="2" text />
      </NCard>
    </section>
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

.notice-card,
.service-link {
  height: 100%;
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
