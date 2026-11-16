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
import { SubmitButton } from "./SubmitButton";
import { LoginLink } from "./LoginLink";
import { NotificationBell } from "./NotificationBell";

/** For the bell. A stale session counts none. */
async function unreadNotifications(): Promise<number> {
  const user = await currentUser();
  return user ? countUnreadNotifications(user.id) : 0;
}

export function Header({ locale, t, signedIn, onLoginPage = false }: { locale: Locale; t: Dict; signedIn: boolean; onLoginPage?: boolean }) {
  const language = <LanguageMenu locale={locale} label={t.nav.language} />;
  const accountLinks = [
    { href: `/${locale}/favorites`, text: t.nav.favorites },
    { href: `/${locale}/saved`, text: t.nav.saved },
    { href: `/${locale}/messages`, text: t.nav.messages },
    { href: `/${locale}/my-listings`, text: t.nav.my },
    { href: `/${locale}/account/profile`, text: t.account.profile },
    { href: `/${locale}/account/settings`, text: t.account.settings },
  ];
  const session = signedIn ? (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton className="btn ghost">{t.nav.logout}</SubmitButton>
    </form>
  ) : onLoginPage ? null : (
    // Not on the sign-in page itself, where it would open the same form over it.
    <LoginLink locale={locale} className="btn ghost">{t.nav.login}</LoginLink>
  );
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
        <Link href={`/${locale}/listings/new`} className="btn">{t.nav.post}</Link>
        {signedIn && <NotificationBell locale={locale} labels={t.notifications} unread={unreadNotifications()} />}
        <div className="nav-wide">
          {language}
          <ThemeToggle labels={t.theme} />
          {signedIn && <AccountMenu label={t.nav.account} links={accountLinks} />}
          {session}
        </div>
        <PhoneMenu label={t.nav.menu}>
          {sections}
          {signedIn && accountLinks.map(({ href, text }) => <Link key={href} href={href} className="nav-link">{text}</Link>)}
          {session}
          {language}
          <ThemeToggle labels={t.theme} />
        </PhoneMenu>
      </div>
      <div className="nav-sections">{sections}</div>
    </header>
  );
}
