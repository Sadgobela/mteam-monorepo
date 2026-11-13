import type { Dict, Locale } from "@mteam/shared";
import { LoginForm } from "./LoginForm";

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

export function LoginPanel({ locale, t, next, heading: Heading = "h1" }: { locale: Locale; t: Dict; next?: string; heading?: "h1" | "h2" }) {
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
        <p className="meta">{t.login.lead}</p>
        <LoginForm locale={locale} t={t} next={next} />
      </div>
    </div>
  );
}
