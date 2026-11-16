"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAccount, PREFERENCE_KEYS, setPreference, signOutDevice, signOutOtherDevices } from "@mteam/db";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { currentUser, endSession, sessionToken, signInHere } from "./session";

const preferenceSchema = z.object({ key: z.enum(PREFERENCE_KEYS), value: z.boolean() });
// A session id is the hex sha256 of its token.
const deviceIdSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** Flips one switch. Called straight from the switch, so it answers whether it was saved instead of redirecting. */
export async function setPreferenceAction(key: unknown, value: unknown): Promise<boolean> {
  const parsed = preferenceSchema.safeParse({ key, value });
  const user = await currentUser();
  if (!parsed.success || !user) return false;
  await setPreference(user.id, parsed.data.key, parsed.data.value);
  return true;
}

/** The signed-in user, this browser's token and the language, or off to the sign-in page. */
async function signedIn(form: FormData) {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  const token = await sessionToken();
  if (!user || !token) redirect(await signInHere(locale));
  return { locale, user, token, settings: `/${locale}/account/settings` };
}

export async function signOutDeviceAction(form: FormData): Promise<void> {
  const { user, token, settings } = await signedIn(form);
  const id = deviceIdSchema.safeParse(form.get("id"));
  if (id.success) await signOutDevice(user.id, id.data, token);
  revalidatePath(settings);
}

export async function signOutOthersAction(form: FormData): Promise<void> {
  const { user, token, settings } = await signedIn(form);
  await signOutOtherDevices(user.id, token);
  revalidatePath(settings);
}

/**
 * Deletes a private person's account once they have confirmed, then signs this browser out and goes home.
 * Brokers and admins are sent back to settings, which tells them to ask an admin; the database refuses them too.
 */
export async function deleteAccountAction(form: FormData): Promise<void> {
  const { locale, user, settings } = await signedIn(form);
  if (form.get("confirm") !== "yes" || user.role !== "USER" || !(await deleteAccount(user.id))) redirect(settings);
  await endSession();
  redirect(`/${locale}`);
}
