<script setup lang="ts">
const props = defineProps<{ title: string; back?: string }>();

const route = useRoute();
const links = [
  ["/admin", "群组配置"],
  ["/admin/users", "用户目录"],
  ["/admin/administrators", "管理员"],
  ["/admin/terms", "任期配置"],
] as const;
const active = computed(() =>
  route.path.startsWith("/admin/users") ? "/admin/users" : route.path,
);

useHead({ title: () => props.title });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader
      :on-back="props.back ? () => navigateTo(props.back) : undefined"
    >
      <template #title>
        <h1>{{ props.title }}</h1>
      </template>
    </NPageHeader>
    <NTabs type="line" :value="active" @update:value="navigateTo($event)">
      <NTab v-for="[to, label] in links" :key="to" :name="to">
        {{ label }}
      </NTab>
    </NTabs>
    <slot />
  </NuxtLayout>
</template>
