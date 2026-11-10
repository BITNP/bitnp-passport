<script setup lang="ts">
const { links } = defineProps<{
  links: readonly (readonly [to: string, label: string])[];
}>();

const route = useRoute();
const active = computed(
  () =>
    links
      .map(([to]) => to)
      .filter((to) => route.path === to || route.path.startsWith(`${to}/`))
      .toSorted((a, b) => b.length - a.length)[0],
);
</script>

<template>
  <NTabs type="line" :value="active">
    <NTab v-for="[to, label] in links" :key="to" :name="to">
      <NuxtLink class="tab-link" :to>{{ label }}</NuxtLink>
    </NTab>
  </NTabs>
</template>

<style scoped>
.tab-link {
  display: inline-block;
  padding: 10px 0;
  margin: -10px 0;
  color: inherit;
  text-decoration: none;
}
</style>
