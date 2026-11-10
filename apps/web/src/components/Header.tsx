import Link from "next/link";
import type { Dict, Locale } from "@mteam/shared";
import { logoutAction } from "@/lib/auth-actions";
import { AccountMenu } from "./AccountMenu";
import { LanguageMenu } from "./LanguageMenu";
import { Logo } from "./Logo";
import { PhoneMenu } from "./PhoneMenu";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  const language = <LanguageMenu locale={locale} label={t.nav.language} />;
  const accountLinks = [
    { href: `/${locale}/favorites`, text: t.nav.favorites },
    { href: `/${locale}/saved`, text: t.nav.saved },
    { href: `/${locale}/messages`, text: t.nav.messages },
    { href: `/${locale}/my-listings`, text: t.nav.my },
  ];
  const session = signedIn ? (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="btn ghost">{t.nav.logout}</button>
    </form>
  ) : (
    <Link href={`/${locale}/login`} className="btn ghost">{t.nav.login}</Link>
  );
  const sections = (
    <nav className="links" aria-label="main">
      <Link href={`/${locale}?deal=sale`}>{t.nav.sale}</Link>
      <Link href={`/${locale}?deal=rent`}>{t.nav.rent}</Link>
      <Link href={`/${locale}?deal=daily`}>{t.nav.daily}</Link>
      <Link href={`/${locale}?verified=1`} className="accent">MTeam Verified</Link>
      <Link href={`/${locale}/brokers`}>{t.nav.brokers}</Link>
      <Link href={`/${locale}/prices`}>{t.nav.prices}</Link>
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
