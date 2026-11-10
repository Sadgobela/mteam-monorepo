import type { Metadata } from "next";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { LoanCalculator } from "@/components/LoanCalculator";
import { resolveLocale } from "@/lib/locale";
import { languageAlternates } from "@/lib/seo";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const STARTING_PRICE = 100_000;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  return { title: getDictionary(locale).nav.mortgage, alternates: languageAlternates("/mortgage", locale) };
}

export default async function MortgagePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="page">
        <h1 className="heading">{t.nav.mortgage}</h1>
        <LoanCalculator price={STARTING_PRICE} symbol="$" t={t} />
      </main>
    </>
  );
}
