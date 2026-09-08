<script setup lang="ts">
import type { NuxtError } from "#app";

defineProps<{ error: NuxtError }>();

useHead({ title: "出错了" });
</script>

<template>
  <NuxtLayout name="default">
    <NResult
      class="error-result"
      :description="error.message"
      :status="
        error.status === 404 ? '404' : error.status === 403 ? '403' : '500'
      "
      :title="error.status === 404 ? '没有找到这个页面' : '无法打开页面'"
    >
      <template #footer>
        <NFlex justify="center">
          <NButton type="primary" @click="clearError({ redirect: '/' })">
            返回首页
          </NButton>
          <LinkButton to="/help">获取帮助</LinkButton>
        </NFlex>
      </template>
    </NResult>
  </NuxtLayout>
</template>

<style scoped>
.error-result {
  padding: 64px 0;
}
</style>
