import Image from "next/image";
import Link from "next/link";
import { locales, type Dict, type Locale } from "@mteam/shared";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ locale, t }: { locale: Locale; t: Dict }) {
  return (
    <header className="nav">
      <Link href={`/${locale}`} className="brand">
        <span className="logo">
          <Image src="/logo-mark.png" alt="" width={26} height={25} />
        </span>
        <span className="brandname">MTeam</span>
      </Link>
      <nav className="links" aria-label="main">
        <Link href={`/${locale}?deal=sale`}>{t.nav.sale}</Link>
        <Link href={`/${locale}?deal=rent`}>{t.nav.rent}</Link>
        <Link href={`/${locale}?deal=daily`}>{t.nav.daily}</Link>
        <Link href={`/${locale}?type=projects`}>{t.nav.projects}</Link>
        <Link href={`/${locale}?city=dubai`}>{t.nav.dubai}</Link>
      </nav>
      <span className="sp" />
      <nav className="lang" aria-label="language">
        {locales.map((l) => (
          <Link key={l} href={`/${l}`} aria-current={l === locale ? "true" : undefined}>
            {l.toUpperCase()}
          </Link>
        ))}
      </nav>
      <ThemeToggle labels={t.theme} />
      <button type="button" className="btn ghost">{t.nav.login}</button>
      <button type="button" className="btn">{t.nav.post}</button>
    </header>
  );
}
