"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@mteam/shared";
import { z } from "zod";
import { loginPath } from "@/lib/login-path";
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

const uploadReplySchema = z.object({ error: z.enum(["signedOut", "photo", "tooMany"]) });

/** The longest side a photo is sent at: plenty for a 256 px avatar, and far under the upload limit. */
const MAX_EDGE_PX = 1024;

/**
 * A phone photo shrunk to at most 1024 px and re-encoded as JPEG before it is sent, upright as the camera meant it.
 * The original goes when the browser cannot decode it; the server checks either way.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

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
    body.set("photo", await shrink(file), file.name);
    let ok = false;
    let reply: unknown = null;
    try {
      const response = await fetch(`/${locale}/account/profile/avatar`, { method: "POST", body });
      ok = response.ok;
      reply = await response.json();
    } catch {
      // No connection, or a proxy's error page instead of our answer: shown as a photo that could not be used.
    }
    const answer = uploadReplySchema.safeParse(reply).data?.error;
    if (ok) router.refresh();
    else if (answer === "signedOut") router.push(loginPath(locale, `/${locale}/account/profile`));
    else setError(answer === "tooMany" ? "tooMany" : "photo");
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
