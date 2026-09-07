import { so1ve } from "@so1ve/eslint-config";

import { withNuxt } from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  so1ve().override("so1ve/vue/rules", (config) => {
    const parser = config.languageOptions.parserOptions.parser;

    config.languageOptions.parserOptions.parser = {
      ...parser,
      parseForESLint(code, options) {
        // typescript-native-bridge cannot parse an empty Vue script.
        return parser.parseForESLint(code || "\n", options);
      },
    };

    return config;
  }),
);
