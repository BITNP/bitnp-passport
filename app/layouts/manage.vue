<script setup lang="ts">
const route = useRoute();
const links = [
  ["/manage", "成员目录"],
  ["/groups", "我管理的群组"],
  ["/jobs", "任务"],
  ["/audit", "记录"],
] as const;
const active = computed(() =>
  route.path.startsWith("/manage") ? "/manage" : `/${route.path.split("/")[1]}`,
);
</script>

<template>
  <NuxtLayout name="page">
    <NTabs type="line" :value="active">
      <NTab
        v-for="[to, label] in links"
        :key="to"
        :name="to"
        @click="navigateTo(to)"
      >
        {{ label }}
      </NTab>
    </NTabs>
    <slot />
  </NuxtLayout>
</template>
