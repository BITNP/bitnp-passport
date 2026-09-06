{
  inputs,
  lib,
  pkgs,
  ...
}:

{
  overlays = [ inputs.js-toolchain-overlay.overlays.default ];

  languages.javascript = {
    enable = true;
    package = lib.mkDefault pkgs.node-bin.latest;
    corepack.enable = true;
    lsp.enable = false;
  };

  env.NVIM_VUE_TYPESCRIPT_PLUGIN_PATH = "${pkgs.vue-language-server}/lib/language-tools/packages/language-server";

  packages = with pkgs; [
    prettier
    prettierd
    vscode-langservers-extracted
    vtsls
    vue-language-server
    yaml-language-server
  ];
}
