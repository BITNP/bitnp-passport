<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const {
  data: site,
  error,
  refresh,
  status,
} = await useFetch("/api/site", {
  key: "site-settings",
});
const editor = ref<NonNullable<typeof site.value>>();
const { submit, pending } = useMutation();
const message = useMessage();

watch(
  site,
  (value) => {
    if (value && !editor.value) {
      editor.value = structuredClone(toRaw(value));
    }
  },
  { immediate: true },
);

const save = () =>
  submit(async () => {
    const saved = await $fetch("/api/admin/site", {
      method: "PUT",
      body: editor.value,
    });

    site.value = saved;
    editor.value = structuredClone(saved);
    message.success("站点设置已保存");
  });

useFetchError(error, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="站点设置">
    <NCard v-if="!editor && status === 'pending'">
      <NSkeleton :repeat="4" text />
    </NCard>
    <NCard v-if="editor">
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem
          label="人工服务地址"
          :label-props="{ for: 'support-url' }"
          required
        >
          <NInput
            v-model:value="editor.supportUrl"
            :input-props="{
              id: 'support-url',
              type: 'url',
              required: true,
              pattern: '(https?://|mailto:).+',
            }"
          />
        </NFormItem>
        <NFormItem label="服务入口">
          <NDynamicInput
            v-model:value="editor.services"
            :disabled="pending"
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
        </NFormItem>
        <NButton attr-type="submit" :loading="pending" type="primary">
          保存设置
        </NButton>
      </NForm>
    </NCard>
  </NuxtLayout>
</template>
