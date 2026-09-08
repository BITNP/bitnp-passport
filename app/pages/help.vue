<script setup lang="ts">
const site = useAppConfig();

useHead({ title: "帮助" });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title><h1>帮助</h1></template>
    </NPageHeader>
    <NCard>
      <NCollapse :default-expanded-names="['password', 'recovery']">
        <NCollapseItem name="password" title="自助重置密码">
          <p>忘记密码可通过电邮验证邮件，自助重置密码。</p>
          <NButton href="/auth/reset-password" tag="a">重置密码</NButton>
        </NCollapseItem>
        <NCollapseItem name="recovery" title="寻求人工服务">
          <p>
            如果无法自助重置密码或有其它需求，请提交以下表单，技术保障中心可能需要先通过其它方式验证你的身份。
          </p>
          <NButton :href="site.supportUrl" tag="a">提交工单</NButton>
        </NCollapseItem>
      </NCollapse>
    </NCard>
  </NuxtLayout>
</template>
