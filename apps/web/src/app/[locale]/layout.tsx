import type { Metadata } from "next";
import { getDictionary, locales } from "@mteam/shared";
import { AntProvider } from "@/components/AntProvider";
import { resolveLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { meta } = getDictionary(resolveLocale((await params).locale));
  return { metadataBase: new URL(siteUrl()), title: { default: meta.title, template: "%s | MTeam" }, description: meta.description };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AntProvider locale={locale}>{children}</AntProvider>
      </body>
    </html>
  );
}
