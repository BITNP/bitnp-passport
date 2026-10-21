<script setup lang="ts">
import { formatDateTime } from "#shared/utils";

const route = useRoute();
const token = String(route.params.token);

const [{ data: invitation, error: loadError, refresh }, { data: session }] =
  await Promise.all([
    useFetch(`/api/invitations/${encodeURIComponent(token)}`),
    usePortalSession(),
  ]);

const { submit, pending } = useMutation();
const authenticate = (mode: "login" | "register") =>
  submit(async () => {
    const result = await $fetch(
      `/api/invitations/${encodeURIComponent(token)}/authorize`,
      {
        method: "POST",
        body: { mode },
      },
    );
    await navigateTo(result.url, { external: true });
  });

useHead({
  title: "群组邀请",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
});

const join = () =>
  submit(async () => {
    try {
      await $fetch(`/api/invitations/${encodeURIComponent(token)}/join`, {
        method: "POST",
      });
    } finally {
      await refresh();
    }
  });

const switchAccount = () =>
  submit(async () => {
    const result = await $fetch("/api/logout", {
      method: "POST",
      query: { returnTo: `/i/${token}` },
    });
    await navigateTo(result.url, { external: true });
  });
</script>

<template>
  <NCard class="invitation">
    <NFlex v-if="invitation" :size="24" vertical>
      <NResult
        v-if="invitation.joined"
        :description="invitation.label"
        status="success"
        title="已加入群组"
      />
      <header v-else>
        <NText depth="3">群组邀请</NText>
        <h1>{{ invitation.label }}</h1>
      </header>
      <NDescriptions :column="1" label-placement="left">
        <NDescriptionsItem v-if="session" label="当前账户">
          <NFlex align="center" :size="8">
            <UserAvatar
              :name="session.user.displayName"
              :size="24"
              :src="session.user.avatarUrl"
            />
            <NText>{{ session.user.displayName }}</NText>
            <NText depth="3">{{ session.user.username }}</NText>
          </NFlex>
        </NDescriptionsItem>
        <NDescriptionsItem label="有效期至">
          {{
            formatDateTime(invitation.expiresAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          }}
        </NDescriptionsItem>
      </NDescriptions>
      <NAlert
        v-if="session && !invitation.joined && route.query.join === 'failed'"
        type="warning"
      >
        加入失败，请重试。
      </NAlert>
      <NFlex :size="12" vertical>
        <template v-if="session">
          <LinkButton
            v-if="invitation.joined"
            block
            size="large"
            to="/account"
            type="primary"
          >
            查看我的账户
          </LinkButton>
          <NButton
            v-else
            block
            :loading="pending"
            size="large"
            type="primary"
            @click="join"
          >
            加入群组
          </NButton>
          <NButton :loading="pending" text @click="switchAccount">
            切换账户
          </NButton>
        </template>
        <template v-else>
          <NButton
            v-if="invitation.allowRegistration"
            block
            :disabled="pending"
            :loading="pending"
            size="large"
            type="primary"
            @click="authenticate('register')"
          >
            注册并加入
          </NButton>
          <NButton
            block
            :disabled="pending"
            :loading="pending"
            size="large"
            :type="invitation.allowRegistration ? 'default' : 'primary'"
            @click="authenticate('login')"
          >
            {{
              invitation.allowRegistration
                ? "已有账号，登录并加入"
                : "登录并加入"
            }}
          </NButton>
        </template>
      </NFlex>
    </NFlex>
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
