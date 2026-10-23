<script setup lang="ts">
import { systemAdministratorRole } from "#shared/identity";

definePageMeta({ middleware: ["auth", "admin"] });
const { data, error, refresh } = await useFetch("/api/admin/administrators");
useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="系统管理权限">
    <NCard title="有效系统权限持有人">
      <NList v-if="data">
        <NListItem v-for="{ user, sources } in data" :key="user.id">
          <div class="administrator-row">
            <NFlex align="center" :size="8">
              <UserIdentity
                class="administrator-name"
                show-username
                :to="`/admin/users/${encodeURIComponent(user.id)}`"
                :user
              />
              <NTag v-if="!user.enabled" :bordered="false" size="small">
                已停用
              </NTag>
            </NFlex>
            <NFlex :size="[16, 8]" wrap>
              <NFlex
                v-for="source in sources"
                :key="`${source.group?.id ?? 'user'}:${source.role}`"
                align="center"
                :size="6"
              >
                <NTag :bordered="false" size="small">{{ source.label }}</NTag>
                <NText class="source-origin" depth="3">
                  {{
                    source.group
                      ? `来自 ${source.group.label}`
                      : source.role === systemAdministratorRole
                        ? "个人特批"
                        : "角色继承"
                  }}
                </NText>
              </NFlex>
            </NFlex>
          </div>
        </NListItem>
      </NList>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.administrator-row {
  display: grid;
  grid-template-columns: minmax(140px, 200px) minmax(0, 1fr);
  align-items: center;
  gap: 8px 24px;
}

.administrator-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.source-origin {
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .administrator-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
