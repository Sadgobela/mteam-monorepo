import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { OnboardingForm } from "@/components/ProfileForms";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { onboardingNext, onboardingPath } from "@/lib/onboarding";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The first-visit questions after any kind of sign-in, then on to the page the user was going to. */
export default async function OnboardingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = resolveLocale((await params).locale);
  const next = onboardingNext((await searchParams).next, locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, onboardingPath(locale, next)));
  if (user.onboardedAt) redirect(next);
  const t = getDictionary(locale);
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="section onboarding">
        <div className="onboarding-card">
          <h1 className="heading">{t.profile.welcome}</h1>
          <p>{t.profile.welcomeLead}</p>
          <OnboardingForm locale={locale} t={t} next={next} name={user.name ?? ""} />
        </div>
      </main>
    </>
  );
}
