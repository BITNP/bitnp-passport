<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type UserDetail = InternalApi["/api/admin/users/:id"]["get"];

const { roles, attributes } = defineProps<{
  roles: UserDetail["roles"];
  attributes: UserDetail["user"]["attributes"];
}>();
</script>

<template>
  <NCard>
    <NCollapse>
      <NCollapseItem name="keycloak" title="Keycloak 详情">
        <NFlex :size="16" vertical>
          <NDescriptions :column="1" label-placement="left" size="small">
            <NDescriptionsItem label="Realm 角色">
              <NFlex v-if="roles.length > 0" :size="8">
                <NTag
                  v-for="role in roles"
                  :key="role.id"
                  :bordered="false"
                  size="small"
                >
                  {{ role.name }}
                </NTag>
              </NFlex>
              <NText v-else depth="3">无</NText>
            </NDescriptionsItem>
          </NDescriptions>
          <NTable
            v-if="Object.keys(attributes ?? {}).length > 0"
            :bordered="false"
            class="attributes"
            size="small"
          >
            <thead>
              <tr>
                <th>属性</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(values, name) in attributes" :key="name">
                <td class="mono">{{ name }}</td>
                <td>
                  <div v-for="(value, index) in values" :key="index">
                    {{ value }}
                  </div>
                </td>
              </tr>
            </tbody>
          </NTable>
        </NFlex>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped>
.attributes {
  table-layout: fixed;
  overflow-wrap: anywhere;
}

.attributes th:first-child {
  width: 30%;
}

.attributes td {
  vertical-align: top;
}
</style>
