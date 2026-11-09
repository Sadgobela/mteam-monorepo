"use client";

import { useActionState } from "react";
import type { Dict } from "@mteam/shared";
import { leadAction } from "@/lib/lead-actions";

export function LeadForm({ t }: { t: Dict }) {
  const [state, action, pending] = useActionState(leadAction, {});
  if (state.sent) return <p className="note" role="status">{t.home.leadSent}</p>;
  return (
    <form className="form-row" action={action}>
      <label className="field">
        <small>{t.home.leadName}</small>
        <input name="name" required maxLength={100} autoComplete="name" pattern=".*\S.*" />
      </label>
      <label className="field">
        <small>{t.login.phone}</small>
        <input name="phone" type="tel" required autoComplete="tel-national" />
      </label>
      <label className="field">
        <small>{t.home.leadGoal}</small>
        <select name="deal" required>
          <option value="sale">{t.home.leadSell}</option>
          <option value="rent">{t.home.leadRent}</option>
        </select>
      </label>
      <button className="btn lead-submit" type="submit" disabled={pending}>{t.home.leadSubmit}</button>
      {state.invalid && <p className="note lead-error" role="alert">{t.home.leadInvalid}</p>}
      {state.failed && <p className="note lead-error" role="alert">{t.home.leadFailed}</p>}
    </form>
  );
}

/** The "Give it to MTeam" offer for owners, with the promises stated plainly. */
export function GiveBand({ t }: { t: Dict }) {
  return (
    <section id="give" className="band">
      <h2>{t.home.bandTitle}</h2>
      <p>{t.home.bandText}</p>
      <LeadForm t={t} />
    </section>
  );
}
