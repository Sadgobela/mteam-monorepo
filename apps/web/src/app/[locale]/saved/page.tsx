import { redirect } from "next/navigation";
import { listSavedSearches } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { deleteSavedSearchAction, openSavedSearchAction } from "@/lib/account-actions";
import { resolveLocale } from "@/lib/locale";
import { searchName } from "@/lib/seo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = getDictionary(locale);
  const searches = await listSavedSearches(user.id);
  const hidden = (id: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
    </>
  );
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page">
        <h1 className="heading">{t.saved.heading}</h1>
        {searches.length === 0 && <EmptyState text={t.saved.empty} />}
        <ul className="saved-list">
          {searches.map((search) => {
            const others = Object.entries(search.filters).filter(([name, value]) => value !== undefined && !["deal", "type", "city"].includes(name)).length;
            return (
              <li key={search.id}>
                <div>
                  <b>{[searchName(search.filters, locale) || t.saved.allListings, others > 0 && `+${others}`].filter(Boolean).join(" ")}</b>
                  {search.newCount > 0 && <div className="saved-new">{t.saved.newCount.replace("{count}", String(search.newCount))}</div>}
                </div>
                <div className="queue-actions">
                  <form action={openSavedSearchAction}>
                    {hidden(search.id)}
                    <button type="submit" className="btn">{t.saved.open}</button>
                  </form>
                  <form action={deleteSavedSearchAction}>
                    {hidden(search.id)}
                    <button type="submit" className="btn ghost">{t.saved.remove}</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
