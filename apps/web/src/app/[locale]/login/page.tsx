import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { LoginPanel } from "@/components/LoginPanel";
import { resolveLocale } from "@/lib/locale";
import { safeNext } from "@/lib/login-path";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = resolveLocale((await params).locale);
  const next = safeNext((await searchParams).next, locale);
  // A real check, not hasSession: an expired cookie would otherwise bounce between this page and the one it came from.
  if (await currentUser()) redirect(next);
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={false} onLoginPage />
      <main className="section login-page">
        <LoginPanel locale={locale} t={t} next={next} />
      </main>
    </>
  );
}
