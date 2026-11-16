"use client";

import { useActionState } from "react";
import Image from "next/image";
import { unstable_rethrow } from "next/navigation";
import type { BrokerProfile } from "@mteam/db";
import type { Dict, Locale } from "@mteam/shared";
import { saveBrokerProfileAction, type BrokerProfileState } from "@/lib/invite-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { withShrunkPhoto } from "@/lib/shrink-photo";

/**
 * Shrinks the photo before it is sent, so a phone photo fits the request limit. A request the server refuses
 * (still too large, or the connection dropped) says so in the form instead of breaking the page.
 */
async function save(previous: BrokerProfileState, form: FormData): Promise<BrokerProfileState> {
  try {
    return await saveBrokerProfileAction(previous, await withShrunkPhoto(form));
  } catch (error) {
    // Sign-in redirects and the like are Next's to handle.
    unstable_rethrow(error);
    return { failed: true };
  }
}

/** A broker's photo and bio, as shown on their public page. The branch is set by MTeam, so it is only shown. */
export function BrokerProfileForm({ locale, t, profile }: { locale: Locale; t: Dict; profile: BrokerProfile }) {
  const copy = t.brokersAdmin;
  const [state, action, pending] = useActionState(save, {});
  return (
    <form action={action} className="broker-form">
      <input type="hidden" name="locale" value={locale} />
      <div className="who">
        <span className="av broker-photo" aria-hidden="true">
          {profile.photoUrl && <Image src={profile.photoUrl} alt="" fill unoptimized />}
        </span>
        <div>
          <small className="meta">{copy.branch}</small>
          <div>
            <b>{profile.branch || copy.noBranch}</b>
          </div>
        </div>
      </div>
      <label className="field">
        <small>{copy.photo}</small>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
        <small>{copy.photoHint}</small>
      </label>
      <label className="field">
        <small>{copy.bio}</small>
        <textarea name="bio" rows={6} maxLength={600} defaultValue={profile.bio ?? ""} />
        <small>{copy.bioHint}</small>
      </label>
      <div>
        <SubmitButton pending={pending}>{copy.save}</SubmitButton>
      </div>
      {state.saved && <p className="note" role="status">{copy.saved}</p>}
      {state.badPhoto && <p className="note" role="alert">{copy.badPhoto}</p>}
      {state.badBio && <p className="note" role="alert">{copy.badBio}</p>}
      {state.failed && <p className="note" role="alert">{copy.saveFailed}</p>}
    </form>
  );
}
