import Image from "next/image";
import Link from "next/link";
import { locales, type Dict, type Locale } from "@mteam/shared";
import { logoutAction } from "@/lib/auth-actions";
import { PhoneMenu } from "./PhoneMenu";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  const language = (
    <nav className="lang" aria-label="language">
      {locales.map((l) => (
        <Link key={l} href={`/${l}`} aria-current={l === locale ? "true" : undefined}>
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
  const account = (
    <>
      {signedIn && (
        <>
          <Link href={`/${locale}/favorites`} className="nav-link">{t.nav.favorites}</Link>
          <Link href={`/${locale}/my-listings`} className="nav-link">{t.nav.my}</Link>
        </>
      )}
      {signedIn ? (
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn ghost">{t.nav.logout}</button>
        </form>
      ) : (
        <Link href={`/${locale}/login`} className="btn ghost">{t.nav.login}</Link>
      )}
    </>
  );
  const sections = (
    <nav className="links" aria-label="main">
      <Link href={`/${locale}?deal=sale`}>{t.nav.sale}</Link>
      <Link href={`/${locale}?deal=rent`}>{t.nav.rent}</Link>
      <Link href={`/${locale}?deal=daily`}>{t.nav.daily}</Link>
      <Link href={`/${locale}?verified=1`} className="accent">mTeam Verified</Link>
      <Link href={`/${locale}?city=dubai`}>{t.nav.dubai}</Link>
      <Link href={`/${locale}/brokers`}>{t.nav.brokers}</Link>
    </nav>
  );

  return (
    <header className="nav">
      <div className="nav-main">
        <Link href={`/${locale}`} className="brand" aria-label="MTeam">
          <span className="logo">
            <Image src="/logo-mark.png" alt="" width={26} height={25} />
          </span>
          <span className="brandname">MTeam</span>
        </Link>
        <span className="sp" />
        <Link href={`/${locale}/listings/new`} className="btn">{t.nav.post}</Link>
        <div className="nav-wide">
          {language}
          <ThemeToggle labels={t.theme} />
          {account}
        </div>
        <PhoneMenu label={t.nav.menu}>
          {sections}
          {account}
          {language}
          <ThemeToggle labels={t.theme} />
        </PhoneMenu>
      </div>
      <div className="nav-sections">{sections}</div>
    </header>
  );
}
