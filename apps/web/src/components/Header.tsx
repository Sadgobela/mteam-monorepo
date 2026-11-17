import Link from "next/link";
import { countUnreadNotifications } from "@mteam/db";
import type { Dict, Locale } from "@mteam/shared";
import { logoutAction } from "@/lib/auth-actions";
import { currentUser } from "@/lib/session";
import { AccountMenu } from "./AccountMenu";
import { LanguageMenu } from "./LanguageMenu";
import { Logo } from "./Logo";
import { PhoneMenu } from "./PhoneMenu";
import { ThemeToggle } from "./ThemeToggle";
import { LoginLink } from "./LoginLink";
import { NotificationBell } from "./NotificationBell";

/** Kept synchronous, so a page never waits for the header: the user is read once and handed on as promises. */
export function Header({ locale, t, signedIn, onLoginPage = false }: { locale: Locale; t: Dict; signedIn: boolean; onLoginPage?: boolean }) {
  const user = signedIn ? currentUser() : null;
  const language = <LanguageMenu locale={locale} label={t.nav.language} />;
  const accountLinks = [
    { href: `/${locale}/favorites`, text: t.nav.favorites },
    { href: `/${locale}/saved`, text: t.nav.saved },
    { href: `/${locale}/messages`, text: t.nav.messages },
    { href: `/${locale}/my-listings`, text: t.nav.my },
    { href: `/${locale}/account/profile`, text: t.account.profile },
    { href: `/${locale}/account/settings`, text: t.account.settings },
  ];
  // Not on the sign-in page itself, where it would open the same form over it. Sign-out is in the account menu.
  const login = signedIn || onLoginPage ? null : <LoginLink locale={locale} className="btn ghost">{t.nav.login}</LoginLink>;
  const sections = (
    <nav className="links" aria-label="main">
      <Link href={`/${locale}?deal=sale`}>{t.nav.sale}</Link>
      <Link href={`/${locale}?deal=rent`}>{t.nav.rent}</Link>
      <Link href={`/${locale}?deal=daily`}>{t.nav.daily}</Link>
      <Link href={`/${locale}?verified=1`} className="accent">MTeam Verified</Link>
      <Link href={`/${locale}/brokers`}>{t.nav.brokers}</Link>
      <Link href={`/${locale}/prices`}>{t.nav.prices}</Link>
      <Link href={`/${locale}/mortgage`}>{t.nav.mortgage}</Link>
    </nav>
  );

  return (
    <header className="nav">
      <div className="nav-main">
        <Link href={`/${locale}`} className="brand" aria-label="MTeam">
          <Logo />
        </Link>
        <span className="sp" />
        {/* One element at every width: the words on a wide screen, a "+" on a phone. The words stay its name. */}
        <Link href={`/${locale}/listings/new`} className="btn post-button">
          <svg className="post-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="post-text">{t.nav.post}</span>
        </Link>
        {/* A stale session counts none and shows no photo. */}
        {user && <NotificationBell locale={locale} labels={t.notifications} unread={user.then((person) => (person ? countUnreadNotifications(person.id) : 0))} />}
        <div className="nav-wide">
          {language}
          <ThemeToggle labels={t.theme} />
          {login}
        </div>
        {user && (
          <AccountMenu
            label={t.nav.account}
            links={accountLinks}
            person={user.then((person) => person && { name: person.name, avatarUrl: person.avatarUrl })}
            locale={locale}
            signOut={t.nav.logout}
            logout={logoutAction}
          />
        )}
        <PhoneMenu label={t.nav.menu}>
          {sections}
          {login}
          {language}
          <ThemeToggle labels={t.theme} />
        </PhoneMenu>
      </div>
      <div className="nav-sections">{sections}</div>
    </header>
  );
}
