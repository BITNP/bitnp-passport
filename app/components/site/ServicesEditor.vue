<script setup lang="ts">
import type { SiteService } from "#shared/types";

defineProps<{ disabled: boolean }>();
const services = defineModel<SiteService[]>("value", { required: true });
</script>

<template>
  <NDynamicInput
    v-model:value="services"
    :disabled
    :on-create="() => ({ name: '', url: '', description: '' })"
    show-sort-button
  >
    <template #create-button-default>添加服务</template>
    <template #default="{ value, index }">
      <NCard embedded size="small">
        <NGrid
          cols="1 m:2"
          item-responsive
          responsive="screen"
          :x-gap="12"
          :y-gap="12"
        >
          <NGi>
            <NFormItem
              label="名称"
              :label-props="{ for: `service-name-${index}` }"
              required
              :show-feedback="false"
            >
              <NInput
                v-model:value="value.name"
                :input-props="{
                  id: `service-name-${index}`,
                  required: true,
                  pattern: '.*\\S.*',
                }"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem
              label="地址"
              :label-props="{ for: `service-url-${index}` }"
              required
              :show-feedback="false"
            >
              <NInput
                v-model:value="value.url"
                :input-props="{
                  id: `service-url-${index}`,
                  type: 'url',
                  required: true,
                  pattern: 'https?://.+',
                }"
              />
            </NFormItem>
          </NGi>
          <NGi span="1 m:2">
            <NFormItem
              label="描述"
              :label-props="{ for: `service-description-${index}` }"
              :show-feedback="false"
            >
              <NInput
                v-model:value="value.description"
                :input-props="{ id: `service-description-${index}` }"
              />
            </NFormItem>
          </NGi>
        </NGrid>
      </NCard>
    </template>
  </NDynamicInput>
</template>
