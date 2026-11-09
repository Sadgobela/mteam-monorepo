"use client";

import type { MouseEvent, ReactNode } from "react";
import { Button, Dropdown } from "antd";
import { languageNames, locales, type Locale } from "@mteam/shared/i18n";

// Flags are drawn here because emoji flags show as plain letters on Windows. Their colours are the flags' own, not theme tokens.
const shapes: Record<Locale, ReactNode> = {
  ka: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <path fill="#e8112d" d="M13 0h4v20h-4zM0 8h30v4H0zM6.5 2.5h1.4v1.3h1.3v1.4H7.9v1.3H6.5V5.2H5.2V3.8h1.3zM22.1 2.5h1.4v1.3h1.3v1.4h-1.3v1.3h-1.4V5.2h-1.3V3.8h1.3zM6.5 13.5h1.4v1.3h1.3v1.4H7.9v1.3H6.5v-1.3H5.2v-1.4h1.3zM22.1 13.5h1.4v1.3h1.3v1.4h-1.3v1.3h-1.4v-1.3h-1.3v-1.4h1.3z" />
    </>
  ),
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path stroke="#fff" strokeWidth="4" d="M0 0l30 20M30 0L0 20" />
      <path stroke="#c8102e" strokeWidth="1.6" d="M0 0l30 20M30 0L0 20" />
      <path stroke="#fff" strokeWidth="6.5" d="M15 0v20M0 10h30" />
      <path stroke="#c8102e" strokeWidth="3.8" d="M15 0v20M0 10h30" />
    </>
  ),
  ru: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039a6" />
      <rect y="13.33" width="30" height="6.67" fill="#d52b1e" />
    </>
  ),
};

function Flag({ locale }: { locale: Locale }) {
  return (
    <svg className="flag" viewBox="0 0 30 20" width="21" height="14" aria-hidden="true">
      {shapes[locale]}
    </svg>
  );
}

// When it is pressed, so a page's path and filters carry over without every page passing them in.
// Pointer down also covers middle-click and long-press, which never fire click; click covers the keyboard.
function keepPlace(event: MouseEvent<HTMLAnchorElement>, target: Locale) {
  const { pathname, search } = window.location;
  event.currentTarget.href = `/${target}${pathname.replace(/^\/[^/]+/, "")}${search}`;
}

export function LanguageMenu({ locale, label }: { locale: Locale; label: string }) {
  const items = locales.map((option) => ({
    key: option,
    label: (
      <a href={`/${option}`} lang={option} className="lang-option" onClick={(event) => keepPlace(event, option)} onPointerDown={(event) => keepPlace(event, option)}>
        <Flag locale={option} />
        {languageNames[option]}
      </a>
    ),
  }));
  return (
    <Dropdown trigger={["click"]} menu={{ items, selectedKeys: [locale] }}>
      <Button aria-label={`${label}: ${languageNames[locale]}`} className="lang-button">
        <Flag locale={locale} />
        {locale.toUpperCase()}
      </Button>
    </Dropdown>
  );
}
