<script setup lang="ts">
import { departmentCodes, departments } from "#shared/identity";

definePageMeta({ middleware: ["auth", "admin"] });

const { data, error, refresh } = await useFetch("/api/admin/appointments");

const sections = [
  { key: "association", label: "主席团" },
  ...departmentCodes.map((key) => ({ key, label: departments[key] })),
];

const groups = computed(() => {
  const appointments = data.value;

  if (!appointments) {
    return [];
  }

  return sections.map((section) => {
    const positions = appointments.filter((position) =>
      position.role.startsWith(`position-${section.key}-`),
    );

    return {
      ...section,
      positions,
    };
  });
});

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="任职管理">
    <NCard><UserSearch /></NCard>
    <NCard v-for="group in groups" :key="group.key" size="small">
      <NCollapse
        arrow-placement="right"
        :default-expanded-names="['association']"
      >
        <NCollapseItem :name="group.key">
          <template #header>
            <NText strong>{{ group.label }}</NText>
          </template>
          <NList size="small">
            <NListItem v-for="position in group.positions" :key="position.role">
              <div class="appointment-row">
                <NText depth="2">{{ position.label }}</NText>
                <NFlex v-if="position.users.length > 0" :size="[16, 8]" wrap>
                  <NuxtLink
                    v-for="user in position.users"
                    :key="user.id"
                    :to="`/admin/users/${encodeURIComponent(user.id)}`"
                  >
                    {{ user.username }}
                  </NuxtLink>
                </NFlex>
                <NText v-else depth="3">暂时空缺</NText>
              </div>
            </NListItem>
          </NList>
        </NCollapseItem>
      </NCollapse>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.appointment-row {
  display: grid;
  grid-template-columns: minmax(160px, max-content) minmax(0, 1fr);
  gap: 8px 24px;
}

.appointment-row a {
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .appointment-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
