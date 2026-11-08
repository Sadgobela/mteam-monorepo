import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  // A real check, not hasSession: an expired cookie would otherwise bounce between this page and the posting page.
  if (await currentUser()) redirect(`/${locale}/listings/new`);
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={false} />
      <main className="section narrow">
        <h1>{t.login.title}</h1>
        <p className="meta">{t.login.lead}</p>
        <LoginForm locale={locale} t={t} />
      </main>
    </>
  );
}
