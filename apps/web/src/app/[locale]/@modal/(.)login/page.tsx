import { getDictionary } from "@mteam/shared";
import { LoginModal } from "@/components/LoginModal";
import { LoginPanel } from "@/components/LoginPanel";
import { resolveLocale } from "@/lib/locale";
import { safeNext } from "@/lib/login-path";

export const dynamic = "force-dynamic";

/**
 * The sign-in page, opened over the current page by any link to it. A direct visit gets the full page instead.
 * No session check: only visitors get these links, and signing in re-renders this, which must keep the form
 * mounted until it has loaded the next page.
 */
export default async function LoginOverlay({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const locale = resolveLocale((await params).locale);
  const next = safeNext((await searchParams).next, locale);
  return (
    <LoginModal>
      <LoginPanel locale={locale} t={getDictionary(locale)} next={next} heading="h2" />
    </LoginModal>
  );
}
