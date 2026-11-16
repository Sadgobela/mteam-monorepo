"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict, Locale } from "@mteam/shared";

/** The account area's own pages, marking the one that is open. Scrolls sideways on a phone. */
export function AccountNav({ locale, t }: { locale: Locale; t: Dict }) {
  const path = usePathname();
  const links = [
    { href: `/${locale}/my-listings`, text: t.nav.my },
    { href: `/${locale}/messages`, text: t.nav.messages },
    { href: `/${locale}/favorites`, text: t.nav.favorites },
    { href: `/${locale}/saved`, text: t.nav.saved },
    { href: `/${locale}/account/notifications`, text: t.account.notifications },
    { href: `/${locale}/account/profile`, text: t.account.profile },
    { href: `/${locale}/account/settings`, text: t.account.settings },
  ];
  return (
    <nav className="account-nav" aria-label={t.account.heading}>
      {links.map(({ href, text }) => (
        <Link key={href} href={href} aria-current={path === href || path?.startsWith(`${href}/`) ? "page" : undefined}>
          {text}
        </Link>
      ))}
    </nav>
  );
}
