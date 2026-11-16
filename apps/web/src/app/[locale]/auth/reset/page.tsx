import { z } from "zod";
import { isResetTokenOpen } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import "@/app/auth.css";
import { AuthForm, EmailField, PasswordField } from "@/components/AuthForms";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/password-actions";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** With a token from a reset email: the new-password form. Without one, or with one that has run out: ask for a link. */
export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const locale = resolveLocale((await params).locale);
  const { token: raw } = await searchParams;
  const token = z.string().min(1).max(100).safeParse(raw);
  const open = token.success && (await isResetTokenOpen(token.data));
  const t = getDictionary(locale);
  const hidden = <input type="hidden" name="locale" value={locale} />;
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="section narrow auth-page">
        {open ? (
          <>
            <h1>{t.auth.resetHeading}</h1>
            <AuthForm action={resetPasswordAction} t={t} submit={t.auth.savePassword}>
              {hidden}
              <input type="hidden" name="token" value={token.data} />
              <PasswordField id="reset-password" name="password" label={t.auth.newPassword} hint={t.auth.passwordHint} />
            </AuthForm>
          </>
        ) : (
          <>
            <h1>{t.auth.forgotHeading}</h1>
            {raw !== undefined && <p className="note" role="alert">{t.auth.errors.badLink}</p>}
            <p className="meta">{t.auth.forgotLead}</p>
            <AuthForm action={forgotPasswordAction} t={t} submit={t.auth.sendLink}>
              {hidden}
              <EmailField id="reset-email" label={t.auth.email} />
            </AuthForm>
          </>
        )}
      </main>
    </>
  );
}
