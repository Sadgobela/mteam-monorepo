import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBrokerProfile } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { currentUser } from "@/lib/session";
import { BrokerProfileForm } from "./BrokerProfileForm";
import "@/app/brokers.css";

export const dynamic = "force-dynamic";

/** A broker's own photo and bio. Only brokers have one. */
export default async function BrokerProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/account/broker`));
  if (user.role !== "AGENT" || !user.agent) notFound();
  const profile = await getBrokerProfile(user.agent.id);
  if (!profile) notFound();
  const t = getDictionary(locale);
  return (
    <main className="account-main narrow">
      <h1 className="heading">{t.brokersAdmin.profile}</h1>
      <BrokerProfileForm locale={locale} t={t} profile={profile} />
      {/* The public page lists only brokers others can call by name. */}
      {user.name && user.phone && <Link href={`/${locale}/brokers/${user.agent.id}`}>{t.brokersAdmin.publicPage}</Link>}
    </main>
  );
}
