<script setup lang="ts">
import { formatDateTime } from "#shared/utils";

definePageMeta({ middleware: "auth" });

const {
  data: devices,
  error: loadError,
  refresh,
} = await useFetch("/api/account/sessions");
const { submit, pending } = useMutation();
const message = useMessage();

const signOut = (id?: string) =>
  submit(async () => {
    const result = await $fetch("/api/account/sessions/logout", {
      method: "POST",
      body: { id },
    });
    if (result.signedOut) {
      await refreshNuxtData("portal-session");
      await navigateTo("/");
    } else {
      message.success("已退出所选登录会话");
      await refresh();
    }
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="account" title="登录设备">
    <template v-if="devices">
      <NFlex align="center" justify="space-between">
        <NText strong>活跃会话</NText>
        <ConfirmAction
          confirm-label="退出其他会话"
          :disabled="
            pending ||
            !devices.some((device) =>
              device.sessions.some((session) => !session.current),
            )
          "
          message="退出除当前会话以外的其他登录？"
          @confirm="signOut()"
        >
          退出其他会话
        </ConfirmAction>
      </NFlex>
      <NCard v-for="(device, index) in devices" :key="index">
        <template #header>
          {{ device.os }} {{ device.osVersion }} {{ device.device }}
        </template>
        <NList>
          <NListItem v-for="session in device.sessions" :key="session.id">
            <NThing>
              <template #header>
                <NFlex align="center" :size="8">
                  <span>{{ session.browser || "未知浏览器" }}</span>
                  <NTag
                    v-if="session.current"
                    :bordered="false"
                    size="small"
                    type="success"
                  >
                    当前会话
                  </NTag>
                </NFlex>
              </template>
              <NDescriptions :column="1" label-placement="left" size="small">
                <NDescriptionsItem label="IP 地址">
                  {{ session.ipAddress }}
                </NDescriptionsItem>
                <NDescriptionsItem label="最近活动">
                  {{ formatDateTime(session.lastAccess * 1000) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="使用的服务">
                  {{
                    session.clients
                      .map((client) => client.clientName || client.clientId)
                      .join("、") || "无"
                  }}
                </NDescriptionsItem>
              </NDescriptions>
            </NThing>
            <template #suffix>
              <ConfirmAction
                confirm-label="退出会话"
                :disabled="pending"
                :message="
                  session.current
                    ? '这会退出你当前使用的会话，确认继续？'
                    : '确认退出该登录会话？'
                "
                @confirm="signOut(session.id)"
              >
                退出
              </ConfirmAction>
            </template>
          </NListItem>
        </NList>
      </NCard>
      <NEmpty v-if="devices.length === 0" description="暂无活跃会话" />
    </template>
  </NuxtLayout>
</template>
