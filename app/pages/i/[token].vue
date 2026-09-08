<script setup lang="ts">
const route = useRoute();
const token = String(route.params.token);

const [{ data: invitation, error: loadError }, { data: session }] =
  await Promise.all([
    useFetch(`/api/invitations/${encodeURIComponent(token)}`),
    usePortalSession(),
  ]);

const { submit, pending } = useMutation();
const joined = ref(false);
const returnTo = encodeURIComponent(`/i/${token}`);

useHead({
  title: "群组邀请",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
});

const join = () =>
  submit(async () => {
    await $fetch(`/api/invitations/${encodeURIComponent(token)}/join`, {
      method: "POST",
    });
    joined.value = true;
  });
</script>

<template>
  <NCard class="invitation">
    <template v-if="invitation">
      <NResult
        v-if="joined"
        :description="invitation.label"
        status="success"
        title="已加入群组"
      >
        <template #footer>
          <LinkButton to="/account" type="primary">查看我的账户</LinkButton>
        </template>
      </NResult>
      <NFlex v-else :size="24" vertical>
        <header>
          <NText depth="3">群组邀请</NText>
          <h1>{{ invitation.label }}</h1>
        </header>
        <NDescriptions :column="1" label-placement="left">
          <NDescriptionsItem v-if="session" label="加入账户">
            <NFlex :size="8">
              <NText>{{ session.user.displayName }}</NText>
              <NText depth="3">{{ session.user.username }}</NText>
            </NFlex>
          </NDescriptionsItem>
          <NDescriptionsItem label="有效期至">
            {{
              new Date(invitation.expiresAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                dateStyle: "medium",
                timeStyle: "short",
              })
            }}
          </NDescriptionsItem>
        </NDescriptions>
        <NFlex :size="12" vertical>
          <NButton
            v-if="session"
            block
            :loading="pending"
            size="large"
            type="primary"
            @click="join"
          >
            加入群组
          </NButton>
          <template v-else>
            <NButton
              block
              :href="`/auth/login?returnTo=${returnTo}`"
              size="large"
              tag="a"
              type="primary"
            >
              登录后加入
            </NButton>
            <NButton :href="`/auth/register?returnTo=${returnTo}`" tag="a" text>
              注册账户
            </NButton>
          </template>
        </NFlex>
      </NFlex>
    </template>
    <NResult
      v-else-if="loadError"
      :description="(loadError.data as any)?.message ?? loadError.message"
      status="warning"
      title="邀请加载失败"
    >
      <template #footer>
        <LinkButton to="/">返回首页</LinkButton>
      </template>
    </NResult>
  </NCard>
</template>

<style scoped>
.invitation {
  max-width: 520px;
  margin: 24px auto;
}

.invitation h1 {
  font-size: 24px;
  line-height: 1.4;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}
</style>
