<script setup lang="ts">
import { darkTheme, dateZhCN, zhCN } from "naive-ui";

import { darkThemeOverrides, lightThemeOverrides } from "~/theme";

const colorMode = useColorMode();
const themeOverrides = computed(() =>
  colorMode.value === "dark" ? darkThemeOverrides : lightThemeOverrides,
);
</script>

<template>
  <NConfigProvider
    :date-locale="dateZhCN"
    :locale="zhCN"
    :theme="colorMode.value === 'dark' ? darkTheme : null"
    :theme-overrides
  >
    <NGlobalStyle />
    <NMessageProvider closable :duration="5000" keep-alive-on-hover>
      <NEl class="site-shell">
        <SiteHeader />
        <main>
          <slot />
        </main>
        <SiteFooter />
      </NEl>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.site-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

main {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 36px 28px 48px;
  flex: 1;
  min-width: 0;
}

@media (max-width: 640px) {
  main {
    padding: 24px 16px 36px;
  }
}
</style>
