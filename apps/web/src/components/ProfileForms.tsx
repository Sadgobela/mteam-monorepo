"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@mteam/shared";
import { z } from "zod";
import { onboardingPath } from "@/lib/onboarding";
import { onboardAction, saveProfileAction } from "@/lib/profile-actions";
import { Avatar } from "./Avatar";
import { ChoicePills } from "./ChoicePills";
import "@/app/profile.css";

export type Intent = "SEEKING" | "OWNER" | "BROKER";
const INTENTS: Intent[] = ["SEEKING", "OWNER", "BROKER"];

/** Name and what brings the user here, shared by onboarding and the profile page. */
function ProfileFields({ t, name, intent }: { t: Dict; name: string; intent?: Intent }) {
  const [chosen, setChosen] = useState(intent);
  const hint = useId();
  return (
    <>
      <div className="field">
        <label className="field">
          <small>{t.profile.name}</small>
          <input name="name" required minLength={2} maxLength={60} pattern=".*\S.*" autoComplete="name" defaultValue={name} aria-describedby={hint} />
        </label>
        <small id={hint}>{t.profile.nameHint}</small>
      </div>
      <div className="field">
        <small>{t.profile.intent}</small>
        <ChoicePills label={t.profile.intent} value={chosen} options={INTENTS.map((value) => ({ value, label: t.profile.intents[value] }))} onChange={setChosen} />
        <input type="hidden" name="intent" value={chosen ?? ""} />
      </div>
      {chosen === "BROKER" && (
        <p className="note" role="status">
          {t.profile.brokerNote}
        </p>
      )}
    </>
  );
}

/** The first-visit questions. Saving continues to `next`. */
export function OnboardingForm({ locale, t, next, name }: { locale: Locale; t: Dict; next: string; name: string }) {
  const [state, action, pending] = useActionState(onboardAction, {});
  return (
    <form className="profile-form" action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <ProfileFields t={t} name={name} />
      <label className="profile-terms">
        <input type="checkbox" name="terms" required />
        {t.profile.terms}
      </label>
      {state.invalid && (
        <p className="note" role="alert">
          {t.profile.invalid}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {t.profile.start}
      </button>
    </form>
  );
}

export function ProfileForm({ locale, t, name, intent }: { locale: Locale; t: Dict; name: string; intent?: Intent }) {
  const [state, action, pending] = useActionState(saveProfileAction, {});
  return (
    <form className="profile-form" action={action}>
      <input type="hidden" name="locale" value={locale} />
      <ProfileFields t={t} name={name} intent={intent} />
      {state.invalid && (
        <p className="note" role="alert">
          {t.profile.invalid}
        </p>
      )}
      {state.saved && (
        <p className="note" role="status">
          {t.profile.saved}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {t.profile.save}
      </button>
    </form>
  );
}

const uploadReplySchema = z.object({ error: z.enum(["photo", "tooMany"]).optional() });

/** The user's photo, replaced as soon as a new one is chosen. The server crops it square and removes its metadata. */
export function AvatarUpload({ locale, t, name, url, joined }: { locale: Locale; t: Dict; name: string | null; url: string | null; joined: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"photo" | "tooMany">();

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const [file] = input.files ?? [];
    if (!file) return;
    setPending(true);
    setError(undefined);
    const body = new FormData();
    body.set("photo", file);
    let reply: unknown = null;
    try {
      reply = await (await fetch(`/${locale}/account/profile/avatar`, { method: "POST", body })).json();
    } catch {
      // A proxy's error page, or no connection: shown as a photo that could not be used.
    }
    const parsed = uploadReplySchema.safeParse(reply);
    if (parsed.success && !parsed.data.error) router.refresh();
    else setError(parsed.data?.error ?? "photo");
    input.value = "";
    setPending(false);
  }

  return (
    <div className="profile-card">
      <Avatar name={name} url={url} large />
      <div>
        {name && <b>{name}</b>}
        <span className="meta">{joined}</span>
        <label className="btn ghost avatar-change" aria-disabled={pending}>
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t.profile.photo} disabled={pending} onChange={upload} />
          {t.profile.photoChange}
        </label>
        {error && (
          <p className="note" role="alert">
            {error === "tooMany" ? t.profile.photoTooMany : t.profile.photoFailed}
          </p>
        )}
      </div>
    </div>
  );
}

/** Shown in the account area instead of the page until the first-visit questions are answered, coming back here after. */
export function OnboardingRedirect({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(onboardingPath(locale, location.pathname + location.search));
  }, [router, locale]);
  return (
    <main className="account-main">
      <Link className="btn" href={`/${locale}/onboarding`}>
        {t.profile.finish}
      </Link>
    </main>
  );
}
