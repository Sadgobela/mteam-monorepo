import type { Dict, Locale } from "@mteam/shared";
import { saveSearchAction } from "@/lib/account-actions";
import { ActionForm } from "./ActionForm";
import { LoginLink } from "./LoginLink";
import { SubmitButton } from "./SubmitButton";

export function SaveSearch({ locale, t, query, signedIn, saved }: { locale: Locale; t: Dict; query: string; signedIn: boolean; saved: boolean }) {
  if (saved) return <span className="meta save-search">{t.saved.done}</span>;
  if (!signedIn) {
    return (
      <LoginLink locale={locale} className="btn ghost save-search">
        {t.saved.save}
      </LoginLink>
    );
  }
  return (
    <ActionForm action={saveSearchAction} done={t.saved.done} failed={t.feedback.failed} className="save-search">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="query" value={query} />
      <SubmitButton className="btn ghost">{t.saved.save}</SubmitButton>
    </ActionForm>
  );
}
