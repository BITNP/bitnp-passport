import { so1ve } from "@so1ve/eslint-config";

import { withNuxt } from "./.nuxt/eslint.config.mjs";

export default withNuxt(so1ve(), {
  files: ["**/*.vue"],
  languageOptions: {
    parserOptions: {
      // TNB's project service fails on template-only SFCs; an explicit project
      // preserves type-aware linting for both template-only and scripted SFCs.
      projectService: false,
      project: ["./.nuxt/tsconfig.app.json"],
    },
  },
});
