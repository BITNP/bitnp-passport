<script setup lang="ts">
interface Permission {
  label: string;
}

const { label, before, after } = defineProps<{
  label?: string;
  before?: Permission[];
  after?: Permission[];
}>();

function formatPermissions(permissions?: Permission[]) {
  if (!permissions) {
    return "未记录";
  }

  return permissions.map((permission) => permission.label).join("、") || "无";
}
</script>

<template>
  <NDescriptions v-if="label" :column="1" label-placement="top" size="small">
    <NDescriptionsItem label="任职或授权">{{ label }}</NDescriptionsItem>
    <NDescriptionsItem label="原权限">
      {{ formatPermissions(before) }}
    </NDescriptionsItem>
    <NDescriptionsItem label="预计变更后权限">
      {{ formatPermissions(after) }}
    </NDescriptionsItem>
  </NDescriptions>
</template>
