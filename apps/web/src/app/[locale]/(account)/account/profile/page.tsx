import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { AvatarUpload, ProfileForm } from "@/components/ProfileForms";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Name, photo and what brings the user here. Email, password, phone and linked accounts live on the security page. */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/account/profile`));
  const profile = await getProfile(user.id);
  const t = getDictionary(locale);
  // Georgia only, so dates read the same for everyone.
  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Tbilisi" }).format(profile.createdAt);
  return (
    <main className="account-main narrow">
      <h1 className="heading">{t.account.profile}</h1>
      <AvatarUpload locale={locale} t={t} name={profile.name} url={profile.avatarUrl} joined={t.profile.joined.replace("{date}", joined)} />
      <ProfileForm locale={locale} t={t} name={profile.name ?? ""} intent={profile.intent ?? undefined} />
      <Link className="tile" href={`/${locale}/account/security`}>
        <b>{t.profile.security}</b>
        <span className="meta">{t.profile.securityHint}</span>
      </Link>
    </main>
  );
}
