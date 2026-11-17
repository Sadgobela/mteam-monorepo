import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { defaultLocale, getDictionary, isLocale, type Dict, type Locale } from "@mteam/shared";
import { readStored, writeStored } from "./storage";

const KEY = "locale";

interface LocaleValue {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
}

/** The phone's language when the app speaks it, else Georgian, as on the site. */
export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? "";
  return isLocale(code) ? code : defaultLocale;
}

const LocaleContext = createContext<LocaleValue>({ locale: defaultLocale, t: getDictionary(defaultLocale), setLocale: () => undefined });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  useEffect(() => {
    readStored(KEY).then((stored) => {
      if (stored && isLocale(stored)) setLocaleState(stored);
    });
  }, []);
  const value = useMemo(
    () => ({
      locale,
      t: getDictionary(locale),
      setLocale: (next: Locale) => {
        setLocaleState(next);
        void writeStored(KEY, next);
      },
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** Fills `{name}` placeholders in a line of copy. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
