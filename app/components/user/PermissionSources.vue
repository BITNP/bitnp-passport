<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import { systemAdministratorRole } from "#shared/identity";

type Source =
  InternalApi["/api/account"]["get"]["permissions"]["activeSources"][number];

defineProps<{
  sources: Source[];
  viewerAdministrator: boolean;
}>();
</script>

<template>
  <NFlex class="permission-sources" :size="16" vertical>
    <NText depth="3">授权来源</NText>
    <NFlex
      v-for="source in sources"
      :key="`${source.group?.id ?? 'user'}:${source.role}`"
      :size="4"
      vertical
    >
      <NText strong>{{ source.label }}</NText>
      <NuxtLink
        v-if="source.group && viewerAdministrator"
        :to="`/groups/${encodeURIComponent(source.group.id)}`"
      >
        {{ source.group.label }}
      </NuxtLink>
      <NText v-else depth="3">
        {{
          source.group?.label ??
          (source.role === systemAdministratorRole ? "个人特批" : "个人角色")
        }}
      </NText>
    </NFlex>
    <NCollapse arrow-placement="right">
      <NCollapseItem name="identifiers" title="查看角色与群组标识">
        <NFlex :size="12" vertical>
          <NFlex
            v-for="source in sources"
            :key="`${source.group?.id ?? 'user'}:${source.role}`"
            :size="4"
            vertical
          >
            <NText class="mono" depth="3">{{ source.role }}</NText>
            <NText v-if="source.group" class="mono" depth="3">
              {{ source.group.path }}
            </NText>
          </NFlex>
        </NFlex>
      </NCollapseItem>
    </NCollapse>
  </NFlex>
</template>

<style scoped>
.permission-sources {
  width: 280px;
  max-width: calc(100vw - 48px);
  overflow-wrap: anywhere;
}
</style>
