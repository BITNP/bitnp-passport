export default defineNuxtConfig({
  compatibilityDate: "2026-09-06",
  modules: ["@nuxt/eslint"],
  eslint: {
    config: { standalone: false },
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      title: "网协通行证",
      htmlAttrs: { lang: "zh-CN" },
    },
  },
});
