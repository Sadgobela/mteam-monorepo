import { z } from "zod";
import { verifyEmail } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import "@/app/auth.css";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Opening the link from the confirmation email confirms the address. */
export default async function VerifyEmailPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const locale = resolveLocale((await params).locale);
  const token = z.string().min(1).max(100).safeParse((await searchParams).token);
  const result = token.success ? await verifyEmail(token.data) : "invalid";
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="section narrow auth-page">
        <h1>{t.auth.verifyHeading}</h1>
        {result === "verified" ? (
          <p className="note" role="status">{t.auth.verified}</p>
        ) : (
          <p className="note" role="alert">{t.auth.errors[result === "taken" ? "taken" : "badLink"]}</p>
        )}
        <a className="btn" href={`/${locale}/account/security`}>{t.auth.toSecurity}</a>
      </main>
    </>
  );
}
