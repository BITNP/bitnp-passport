<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const {
  data: security,
  error: loadError,
  refresh,
} = await useFetch("/api/account/security");
const { submit, pending } = useMutation();
const password = computed(() =>
  security.value?.credentials.find((type) => type.type === "password"),
);
const authenticators = computed(
  () =>
    security.value?.credentials.filter(
      (type) =>
        type.type !== "password" &&
        // 无凭据且不能添加的认证方式没有可用操作
        (type.credentials.length > 0 || type.createAction),
    ) ?? [],
);

const labels: Record<string, string> = {
  "otp": "身份验证器",
  "webauthn": "安全密钥",
  "webauthn-passwordless": "通行密钥",
  "recovery-authn-codes": "恢复码",
};

const createdAt = (value: number | null | undefined) =>
  value && value > 0
    ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : "未知";

const startAction = (action: string) =>
  submit(async () => {
    const result = await $fetch("/api/account/actions", {
      method: "POST",
      body: { action },
    });
    await navigateTo(result.url, { external: true });
  });

const removeCredential = (id: string) =>
  submit(async () => {
    const result = await $fetch(
      `/api/account/credentials/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
    await navigateTo(result.url, { external: true });
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="account" title="账户安全">
    <template v-if="security">
      <NCard
        v-if="password && (password.updateAction || password.createAction)"
        title="密码"
      >
        <template #header-extra>
          <NButton href="/auth/reset-password" tag="a" text>忘记密码？</NButton>
        </template>
        <NButton
          :loading="pending"
          type="primary"
          @click="
            startAction((password.updateAction || password.createAction)!)
          "
        >
          {{ password.credentials.length > 0 ? "修改密码" : "设置密码" }}
        </NButton>
      </NCard>
      <NCard
        v-for="type in authenticators"
        :key="type.type"
        :title="labels[type.type] || type.type"
      >
        <template #header-extra>
          <NButton
            v-if="type.createAction"
            :disabled="pending"
            size="small"
            @click="startAction(type.createAction)"
          >
            添加
          </NButton>
        </template>
        <NList v-if="type.credentials.length > 0">
          <NListItem
            v-for="credential in type.credentials"
            :key="credential.id"
          >
            <NThing
              :description="`添加时间：${createdAt(credential.createdDate)}`"
              :title="credential.userLabel || labels[type.type] || type.type"
            />
            <template #suffix>
              <NFlex :size="8">
                <NButton
                  v-if="type.updateAction"
                  :disabled="pending"
                  size="small"
                  @click="startAction(type.updateAction)"
                >
                  更新
                </NButton>
                <ConfirmAction
                  v-if="type.removeable"
                  :disabled="pending"
                  message="确认移除此凭据？"
                  @confirm="removeCredential(credential.id)"
                >
                  移除
                </ConfirmAction>
              </NFlex>
            </template>
          </NListItem>
        </NList>
        <NEmpty v-else description="尚未设置" />
      </NCard>
    </template>
  </NuxtLayout>
</template>
