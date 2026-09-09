<template>
  <NLayoutFooter>
    <NFlex
      align="center"
      class="footer-content"
      justify="space-between"
      :size="12"
    >
      <NText depth="3" tag="small">
        北京理工大学网络开拓者协会 · 图标来自
        <a href="https://www.flaticon.com/authors/freepik">Freepik</a>
      </NText>
      <NFlex align="center" :size="20">
        <LinkButton size="tiny" text to="/tos">使用条款</LinkButton>
        <LinkButton size="tiny" text to="/help">联系与帮助</LinkButton>
      </NFlex>
    </NFlex>
  </NLayoutFooter>
</template>

<style scoped>
.footer-content {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 24px 28px;
}

@media (max-width: 640px) {
  .footer-content {
    padding: 20px 16px;
  }
}
</style>
