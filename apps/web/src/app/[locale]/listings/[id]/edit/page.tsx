import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEditableListing, getGelPerUsd } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingForm } from "@/components/ListingForm";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The owner's own listing in the posting form, filled in. A draft opened from my listings lands here too. */
export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/listings/${encodeURIComponent(id)}/edit`));
  const t = getDictionary(locale);
  const listing = await getEditableListing(user.id, id);
  if (!listing) notFound();
  const { saved } = await searchParams;
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="section post-page">
        <h1>{listing.status === "DRAFT" ? t.post.heading : t.post.editHeading}</h1>
        {saved ? (
          <>
            <p className="note" role="status">{listing.status === "ACTIVE" ? t.post.savedLive : t.post.savedReview}</p>
            <Link href={`/${locale}/my-listings`}>{t.post.toMyListings}</Link>
          </>
        ) : (
          <ListingForm locale={locale} t={t} gelPerUsd={await getGelPerUsd()} initial={listing} ai={Boolean(process.env.ANTHROPIC_API_KEY)} />
        )}
      </main>
    </>
  );
}
