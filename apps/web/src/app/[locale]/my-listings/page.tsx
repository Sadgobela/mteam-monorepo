import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyListings } from "@mteam/db";
import { formatPrice, getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { archiveListingAction } from "@/lib/account-actions";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyListingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = getDictionary(locale);
  const mine = await listMyListings(user.id);
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page narrow">
        <div className="row">
          <h1 className="heading">{t.my.heading}</h1>
          <Link href={`/${locale}/listings/new`} className="btn">{t.nav.post}</Link>
        </div>
        {mine.length === 0 && <p className="meta">{t.my.empty}</p>}
        <ul className="mine">
          {mine.map(({ listing, status }) => (
            <li key={listing.id}>
              <div>
                {status === "ACTIVE" ? <Link href={`/${locale}/listings/${listing.id}`}><b>{listing.title}</b></Link> : <b>{listing.title}</b>}
                <div className="meta">
                  {formatPrice(listing.price, listing.currency)} · {listing.address}
                </div>
              </div>
              <span className="status">{t.my.status[status]}</span>
              {status !== "ARCHIVED" && (
                <form action={archiveListingAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button type="submit" className="btn ghost">{t.my.archive}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
