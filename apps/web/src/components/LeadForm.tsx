"use client";

import { useActionState } from "react";
import type { Dict } from "@mteam/shared";
import { leadAction } from "@/lib/lead-actions";
import { FormSelect } from "./FormSelect";
import { SubmitButton } from "./SubmitButton";

/** An owner's request to hand a property to MTeam, or, given a search, a request for a broker to find a property like it. */
export function LeadForm({ t, seek }: { t: Dict; seek?: { search: string; deal: string } }) {
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
      {seek ? (
        <>
          <input type="hidden" name="search" value={seek.search} />
          <input type="hidden" name="deal" value={seek.deal} />
        </>
      ) : (
        <FormSelect
          name="deal"
          label={t.home.leadGoal}
          initial="sale"
          options={[
            { value: "sale", label: t.home.leadSell },
            { value: "rent", label: t.home.leadRent },
          ]}
        />
      )}
      <SubmitButton className="btn lead-submit" pending={pending}>{seek ? t.assistant.brokerSubmit : t.home.leadSubmit}</SubmitButton>
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
