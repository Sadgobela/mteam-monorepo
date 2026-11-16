"use client";

import { useActionState, useState } from "react";
import type { Dict, Locale } from "@mteam/shared";
import { FormSelect } from "@/components/FormSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { createInviteAction } from "@/lib/invite-actions";

/** The new link, with a button that copies it. Keyed by the link, so "Copied" starts over for the next one. */
function CopyLink({ link, t }: { link: string; t: Dict }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="note invite-link" role="status">
      <p>{t.brokersAdmin.created}</p>
      <div className="invite-copy">
        <input readOnly value={link} aria-label={t.brokersAdmin.inviteHeading} onFocus={(event) => event.target.select()} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? t.brokersAdmin.copied : t.brokersAdmin.copy}
        </button>
      </div>
    </div>
  );
}

/** Makes an invite link, optionally for a branch, and shows it once. */
export function InviteCreator({ locale, t, branches }: { locale: Locale; t: Dict; branches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createInviteAction, {});
  return (
    <>
      <form action={action} className="form-row invite-form">
        <input type="hidden" name="locale" value={locale} />
        <FormSelect name="branchId" label={t.brokersAdmin.branch} optional options={branches.map(({ id, name }) => ({ value: id, label: name }))} />
        <SubmitButton pending={pending}>{t.brokersAdmin.create}</SubmitButton>
      </form>
      {state.link && <CopyLink key={state.link} link={state.link} t={t} />}
      {state.failed && <p className="note" role="alert">{t.brokersAdmin.failed}</p>}
    </>
  );
}
