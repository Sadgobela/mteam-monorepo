import { z } from "zod";
import { getDictionary } from "@mteam/shared";
import "@/app/auth.css";
import { AuthForm } from "@/components/AuthForms";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { confirmEmailAction } from "@/lib/password-actions";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The link from the confirmation email. Opening it changes nothing: mail scanners open links too. The signed-in owner
 * of the account confirms with a button; anyone else is asked to sign in to that account first.
 */
export default async function VerifyEmailPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const locale = resolveLocale((await params).locale);
  const token = z.string().min(1).max(100).safeParse((await searchParams).token);
  const user = await currentUser();
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="section narrow auth-page">
        <h1>{t.auth.verifyHeading}</h1>
        {!token.success ? (
          <p className="note" role="alert">{t.auth.errors.badLink}</p>
        ) : user ? (
          <>
            <p className="meta">{t.auth.confirmLead}</p>
            <AuthForm action={confirmEmailAction} t={t} submit={t.auth.confirmEmail}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token.data} />
            </AuthForm>
          </>
        ) : (
          <>
            <p className="meta">{t.auth.signInToConfirm}</p>
            <a className="btn" href={loginPath(locale, `/${locale}/auth/verify?token=${token.data}`)}>{t.auth.signIn}</a>
          </>
        )}
        <a className="link-button" href={`/${locale}/account/security`}>{t.auth.toSecurity}</a>
      </main>
    </>
  );
}
