"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, type ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";
import kaGE from "antd/locale/ka_GE";
import ruRU from "antd/locale/ru_RU";
import { getDictionary, type Locale } from "@mteam/shared/i18n";

const languages = { ka: kaGE, en: enUS, ru: ruRU };

// Hex here because Ant derives its hover and active shades from it. Surfaces and text follow the
// light and dark themes through the --ant-* overrides in globals.css, so a saved theme never flashes.
const theme: ThemeConfig = {
  cssVar: { key: "mteam" },
  token: { colorPrimary: "#986dc6", fontFamily: "var(--sans)", fontSize: 15, borderRadius: 10, controlHeight: 44 },
  components: {
    Button: { defaultBg: "var(--surface)", defaultColor: "var(--fg)", defaultBorderColor: "var(--line)", defaultHoverBg: "var(--surface)", defaultHoverColor: "var(--brand-deep)", defaultHoverBorderColor: "var(--brand)", defaultActiveBg: "var(--brand-soft)", defaultActiveColor: "var(--brand-deep)", defaultActiveBorderColor: "var(--brand)", textTextColor: "var(--fg)", textHoverBg: "var(--brand-soft)", textTextHoverColor: "var(--brand-deep)", textTextActiveColor: "var(--brand-deep)" },
    Select: { selectorBg: "var(--surface)", optionSelectedBg: "var(--brand-soft)", optionSelectedColor: "var(--brand-deep)", optionActiveBg: "var(--brand-soft)" },
    Pagination: { itemBg: "var(--surface)", itemActiveBg: "var(--brand-soft)", itemLinkBg: "var(--surface)", itemInputBg: "var(--surface)" },
    Modal: { contentBg: "var(--surface)", headerBg: "var(--surface)", footerBg: "var(--surface)", titleColor: "var(--fg)" },
    Drawer: { colorBgElevated: "var(--surface)", colorText: "var(--fg)", colorIcon: "var(--muted)" },
    Segmented: { trackBg: "var(--brand-soft)", itemColor: "var(--fg)", itemHoverColor: "var(--brand-deep)", itemSelectedBg: "var(--action)", itemSelectedColor: "var(--on-action)" },
  },
};

export function AntProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Ant's Georgian and Russian packs leave this label in English.
  const language = { ...languages[locale], global: { ...languages[locale].global, clear: getDictionary(locale).search.clear } };
  return (
    <AntdRegistry>
      <ConfigProvider locale={language} theme={theme}>
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
