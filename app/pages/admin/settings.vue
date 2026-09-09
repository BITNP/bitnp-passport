<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

definePageMeta({ middleware: ["auth", "admin"] });

const {
  data: site,
  error,
  refresh,
  status,
} = await useFetch("/api/site", {
  key: "site-settings",
});
const editor = ref<InternalApi["/api/site"]["get"]>();
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
          <SiteServicesEditor
            v-model:value="editor.services"
            :disabled="pending"
          />
        </NFormItem>
        <NButton attr-type="submit" :loading="pending" type="primary">
          保存设置
        </NButton>
      </NForm>
    </NCard>
  </NuxtLayout>
</template>
