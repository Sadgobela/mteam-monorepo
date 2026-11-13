import type { Dict, Locale } from "@mteam/shared";
import { configuredProviders, type ProviderName } from "@/lib/oauth";
import { LoginForm } from "./LoginForm";

/** Each provider's own mark, as their guidelines ask for on a sign-in button. */
const marks: Record<ProviderName, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.9 11.9 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9a4.7 4.7 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4.1zM14 5.1c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  ),
};

/** A door with a key in it, drawn for this site. */
function Art() {
  return (
    <svg className="login-art-picture" viewBox="0 0 200 150" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 140h156" />
      <path d="M40 140V70l60-44 60 44v70" />
      <path d="M78 140V92a22 22 0 0 1 44 0v48" />
      <circle cx="112" cy="118" r="3" fill="currentColor" />
      <path d="M100 26V12m-22 30-9-11m53 11 9-11" opacity=".55" />
      <circle cx="150" cy="104" r="11" />
      <path d="M150 115v25m0-14h7m-7 8h5" />
    </svg>
  );
}

export function LoginPanel({ locale, t, next, heading: Heading = "h1", failed = false }: { locale: Locale; t: Dict; next?: string; heading?: "h1" | "h2"; failed?: boolean }) {
  const providers = configuredProviders();
  // Full page loads: the provider's pages cannot open inside this one.
  const start = (provider: ProviderName) => `/api/auth/${provider}?${new URLSearchParams({ locale, next: next ?? `/${locale}` })}`;
  return (
    <div className="login">
      <aside className="login-art">
        <Art />
        <ul>
          {t.login.perks.map((perk) => <li key={perk}>{perk}</li>)}
        </ul>
      </aside>
      <div className="login-main">
        <Heading id="login-title">{t.login.title}</Heading>
        {failed && <p className="note" role="alert">{t.login.errors.social}</p>}
        {providers.length > 0 && (
          <>
            <div className="social">
              {providers.map((provider) => (
                <a key={provider} href={start(provider)} className={`btn social-${provider}`}>
                  {marks[provider]}
                  {t.login.with[provider]}
                </a>
              ))}
            </div>
            <p className="login-or"><span>{t.login.or}</span></p>
          </>
        )}
        <p className="meta">{t.login.lead}</p>
        <LoginForm locale={locale} t={t} next={next} />
      </div>
    </div>
  );
}
