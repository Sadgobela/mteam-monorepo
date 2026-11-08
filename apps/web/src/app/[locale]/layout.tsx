import type { Metadata } from "next";
import { locales } from "@mteam/shared";
import { resolveLocale } from "@/lib/locale";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

export const metadata: Metadata = {
  title: "MTeam: უძრავი ქონება",
  description: "mTeam-ის ბროკერების მიერ გადამოწმებული განცხადებები: თბილისი, ბათუმი, დუბაი.",
};

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
      <body>{children}</body>
    </html>
  );
}
