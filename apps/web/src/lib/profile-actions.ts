"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeOnboarding, updateProfile } from "@mteam/db";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { loginPath } from "./login-path";
import { onboardingNext, onboardingPath } from "./onboarding";
import { currentUser, signInHere } from "./session";

export interface ProfileState {
  invalid?: boolean;
  saved?: boolean;
}

/** A name others will read: 2 to 60 characters once trimmed, no control or invisible characters. */
const fieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[^\p{C}]+$/u),
  intent: z.enum(["SEEKING", "OWNER", "BROKER"]),
});

const onboardingSchema = fieldsSchema.extend({ terms: z.literal("on") });

/** Saves the first-visit answers and accepts the terms, then continues to the page the user was going to. */
export async function onboardAction(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const locale = resolveLocale(String(form.get("locale")));
  const next = onboardingNext(form.get("next"), locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, onboardingPath(locale, next)));
  // Answered already, in another tab: the first answers and their terms date stay.
  if (user.onboardedAt) redirect(next);
  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: true };
  await completeOnboarding(user.id, { name: parsed.data.name, intent: parsed.data.intent });
  redirect(next);
}

export async function saveProfileAction(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  const parsed = fieldsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: true };
  await updateProfile(user.id, parsed.data);
  revalidatePath(`/${locale}/account/profile`);
  return { saved: true };
}
