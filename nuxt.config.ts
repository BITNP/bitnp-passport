import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";

import { version } from "./package.json";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-06",
  ssr: false,
  appConfig: {
    version,
  },
  modules: ["@nuxt/eslint", "@nuxtjs/color-mode"],
  imports: {
    presets: [{ from: "naive-ui", imports: ["useMessage"] }],
  },
  vite: {
    plugins: [
      Components({
        dirs: [],
        dts: false,
        resolvers: [NaiveUiResolver()],
      }),
    ],
  },
  css: ["~/assets/css/main.css"],
  nitro: {
    imports: {
      dirs: ["server/session.ts", "server/authentication.ts"],
    },
  },
  hooks: {
    "nitro:config"(config) {
      // Process errors before Nuxt renders its JSON response or error page.
      config.errorHandler = [
        "~~/server/error.ts",
        ...[config.errorHandler ?? []].flat(),
      ];
    },
  },
  eslint: {
    config: { standalone: false },
  },
  app: {
    head: {
      titleTemplate: "%s %separator 网协通行证",
      htmlAttrs: { lang: "zh-CN" },
      link: [
        {
          rel: "icon",
          type: "image/png",
          sizes: "512x512",
          href: "/favicon.png",
        },
      ],
    },
  },
});
