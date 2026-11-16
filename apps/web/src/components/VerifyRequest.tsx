"use client";

import { useActionState } from "react";
import type { Dict, Locale } from "@mteam/shared";
import { requestVerifyAction } from "@/lib/invite-actions";
import "@/app/brokers.css";

/** "Ask MTeam to verify", for the owner of a listing nobody has verified yet. One click files a lead for a broker visit. */
export function VerifyRequest({ listingId, locale, t }: { listingId: number; locale: Locale; t: Dict }) {
  const copy = t.brokersAdmin;
  const [state, action, pending] = useActionState(requestVerifyAction, {});
  if (state.sent) return <p className="note" role="status">{copy.verifySent}</p>;
  return (
    <form action={action} className="note verify-request">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />
      <p>{copy.verifyLead}</p>
      <button type="submit" className="btn" disabled={pending}>{copy.verifyAsk}</button>
      {state.failed && <p role="alert">{copy.verifyFailed}</p>}
    </form>
  );
}
