import type { ReactNode } from "react";
import { getDictionary } from "@mteam/shared";
import { AccountNav } from "@/components/AccountNav";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { currentUser, hasSession } from "@/lib/session";

/** The signed-in area: a sidebar of the account's pages next to the page. Each page checks the session itself and sends visitors to sign in. */
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <div className="page account-layout">
        <AccountNav locale={locale} t={t} role={(await currentUser())?.role} />
        {children}
      </div>
    </>
  );
}
