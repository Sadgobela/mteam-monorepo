import Link from "next/link";
import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingForm } from "@/components/ListingForm";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import { loginPath } from "@/lib/login-path";

export const dynamic = "force-dynamic";

export default async function NewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  if (!(await currentUser())) redirect(loginPath(locale, `/${locale}/listings/new`));
  const t = getDictionary(locale);
  const { sent } = await searchParams;
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="section narrow">
        <h1>{t.post.heading}</h1>
        {sent ? (
          <>
            <p className="note" role="status">{t.post.sent}</p>
            <Link href={`/${locale}/listings/new`}>{t.post.another}</Link>
          </>
        ) : (
          <ListingForm locale={locale} t={t} />
        )}
      </main>
    </>
  );
}
