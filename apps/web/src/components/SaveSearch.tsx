import Link from "next/link";
import type { Dict, Locale } from "@mteam/shared";
import { saveSearchAction } from "@/lib/account-actions";

export function SaveSearch({ locale, t, query, signedIn, saved }: { locale: Locale; t: Dict; query: string; signedIn: boolean; saved: boolean }) {
  if (saved) return <span className="meta save-search">{t.saved.done}</span>;
  if (!signedIn) {
    return (
      <Link href={`/${locale}/login`} className="btn ghost save-search">
        {t.saved.save}
      </Link>
    );
  }
  return (
    <form action={saveSearchAction} className="save-search">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="query" value={query} />
      <button type="submit" className="btn ghost">
        {t.saved.save}
      </button>
    </form>
  );
}
