import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Placeholder until its track of docs/ACCOUNT_PLAN.md lands. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  if (!(await currentUser())) redirect(loginPath(locale, `/${locale}/account/settings`));
  const t = getDictionary(locale);
  return (
    <main className="account-main narrow">
      <h1 className="heading">{t.account.settings}</h1>
      <EmptyState text={t.account.soon} />
    </main>
  );
}
