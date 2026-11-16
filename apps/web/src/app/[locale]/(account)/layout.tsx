import type { ReactNode } from "react";
import { getDictionary } from "@mteam/shared";
import { AccountNav } from "@/components/AccountNav";
import { Header } from "@/components/Header";
import { OnboardingGate } from "@/components/ProfileForms";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

/**
 * The signed-in area: a sidebar of the account's pages next to the page. Each page checks the session itself and sends
 * visitors to sign in. A new account answers the first-visit questions first; the redirect runs in the browser, since a
 * layout cannot see the address to come back to.
 */
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const user = await currentUser();
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <div className="page account-layout">
        <OnboardingGate locale={locale} t={t} needed={Boolean(user && !user.onboardedAt)}>
          <AccountNav locale={locale} t={t} role={user?.role} />
          {children}
        </OnboardingGate>
      </div>
    </>
  );
}
