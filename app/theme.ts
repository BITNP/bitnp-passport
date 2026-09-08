import type { GlobalThemeOverrides } from "naive-ui";

const baseThemeOverrides: GlobalThemeOverrides = {
  common: {
    borderRadius: "6px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
    fontSize: "14px",
    lineHeight: "1.6",
  },
  Card: {
    borderRadius: "10px",
    paddingMedium: "24px",
    titleFontSizeMedium: "16px",
    titleFontWeight: "600",
  },
  Button: { fontWeight: "500" },
  DataTable: { thFontWeight: "500", borderRadius: "8px" },
  PageHeader: { titleFontSize: "24px", titleFontWeight: "600" },
};

export const lightThemeOverrides: GlobalThemeOverrides = {
  ...baseThemeOverrides,
  common: {
    ...baseThemeOverrides.common,
    primaryColor: "#315ac7",
    primaryColorHover: "#456ed9",
    primaryColorPressed: "#2548a8",
    primaryColorSuppl: "#315ac7",
    bodyColor: "#f6f7f9",
    textColorBase: "#202734",
    textColor1: "#202734",
    textColor2: "#475467",
    textColor3: "#667085",
    borderColor: "#e3e7ee",
  },
  Empty: { textColor: "#667085", extraTextColor: "#667085" },
  DataTable: {
    ...baseThemeOverrides.DataTable,
    thColor: "#f8f9fb",
    tdColorHover: "#f8faff",
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  ...baseThemeOverrides,
  common: {
    ...baseThemeOverrides.common,
    primaryColor: "#8aa7ff",
    primaryColorHover: "#adc2ff",
    primaryColorPressed: "#6d90ef",
    primaryColorSuppl: "#8aa7ff",
  },
};
