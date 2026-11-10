<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{
  title: string;
  links: readonly (readonly [to: string, label: string])[];
  back?: RouteLocationRaw;
}>();

const route = useRoute();
const router = useRouter();

const active = computed(
  () =>
    props.links
      .map(([to]) => to)
      .filter((to) => route.path === to || route.path.startsWith(`${to}/`))
      .toSorted((a, b) => b.length - a.length)[0],
);

const onBack = computed(() => {
  const fallback = props.back;
  if (!fallback) {
    return undefined;
  }

  return () =>
    window.history.state?.back ? router.back() : navigateTo(fallback);
});

useHead({ title: () => props.title });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader class="section-heading" :on-back>
      <template #title>
        <h1>{{ props.title }}</h1>
      </template>
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </NPageHeader>
    <NTabs type="line" :value="active">
      <NTab v-for="[to, label] in props.links" :key="to" :name="to">
        <NuxtLink class="tab-link" :to>{{ label }}</NuxtLink>
      </NTab>
    </NTabs>
    <slot />
  </NuxtLayout>
</template>

<style scoped>
.section-heading :deep(.n-page-header) {
  flex-wrap: wrap;
  gap: 12px;
}

.section-heading :deep(.n-page-header__main) {
  min-width: 0;
  max-width: 100%;
}

.section-heading :deep(.n-page-header__title) {
  min-width: 0;
  margin-right: 0;
  overflow-wrap: anywhere;
}

.tab-link {
  display: inline-block;
  padding: 10px 0;
  margin: -10px 0;
  color: inherit;
  text-decoration: none;
}
</style>
