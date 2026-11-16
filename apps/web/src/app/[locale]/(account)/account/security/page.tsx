import { redirect } from "next/navigation";
import { getAccountSecurity } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import "@/app/auth.css";
import { AuthForm, EmailField, PasswordField } from "@/components/AuthForms";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { changeEmailAction, changePasswordAction } from "@/lib/password-actions";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The account's email, its password and the ways it signs in. Nothing here removes a way to sign in. */
export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/account/security`));
  const t = getDictionary(locale);
  const copy = t.auth.security;
  const security = await getAccountSecurity(user.id);
  const hidden = <input type="hidden" name="locale" value={locale} />;
  const methods = [
    { name: copy.methods.phone, detail: security.phone, used: security.phone !== null },
    { name: copy.methods.google, used: security.providers.includes("GOOGLE") },
    { name: copy.methods.facebook, used: security.providers.includes("FACEBOOK") },
    { name: copy.methods.apple, used: security.providers.includes("APPLE") },
    { name: copy.methods.email, used: security.email !== null && security.hasPassword },
  ];
  return (
    <main className="account-main narrow">
      <h1 className="heading">{copy.heading}</h1>

      <section className="security-card" aria-labelledby="security-email">
        <h2 id="security-email">{copy.emailHeading}</h2>
        {security.email ? (
          <p className="security-email">
            <b>{security.email}</b>
            <span className={security.emailVerified ? "security-tag" : "security-tag off"}>{security.emailVerified ? copy.verifiedTag : copy.unverifiedTag}</span>
          </p>
        ) : (
          <p className="meta">{copy.noEmail}</p>
        )}
        {security.email && !security.emailVerified && (
          <AuthForm action={changeEmailAction} t={t} submit={copy.resend}>
            {hidden}
            <input type="hidden" name="email" value={security.email} />
          </AuthForm>
        )}
        <AuthForm action={changeEmailAction} t={t} submit={security.email ? copy.changeEmail : copy.addEmail}>
          {hidden}
          <EmailField id="security-new-email" label={copy.newEmail} />
          {security.hasPassword && <PasswordField id="security-email-password" name="current" label={t.auth.currentPassword} />}
        </AuthForm>
      </section>

      <section className="security-card" aria-labelledby="security-password">
        <h2 id="security-password">{copy.passwordHeading}</h2>
        {security.email ? (
          <AuthForm action={changePasswordAction} t={t} submit={security.hasPassword ? copy.changePassword : copy.setPassword}>
            {hidden}
            {security.hasPassword && <PasswordField id="security-current" name="current" label={t.auth.currentPassword} />}
            <PasswordField id="security-password-new" name="password" label={t.auth.newPassword} hint={t.auth.passwordHint} />
          </AuthForm>
        ) : (
          <p className="meta">{copy.needEmail}</p>
        )}
      </section>

      <section className="security-card" aria-labelledby="security-methods">
        <h2 id="security-methods">{copy.methodsHeading}</h2>
        <ul className="security-methods">
          {methods.map(({ name, detail, used }) => (
            <li key={name}>
              <span>
                {name}
                {detail && <small className="meta">{detail}</small>}
              </span>
              <span className={used ? "security-tag" : "security-tag off"}>{used ? copy.inUse : copy.notInUse}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
