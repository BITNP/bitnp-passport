export default defineNuxtConfig({
  compatibilityDate: "2026-09-06",
  modules: ["@nuxt/eslint"],
  css: ["~/assets/css/main.css"],
  eslint: {
    config: { standalone: false },
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      titleTemplate: "%s | 网协通行证",
      htmlAttrs: { lang: "zh-CN" },
    },
  },
});
