"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { acceptInvite, claimInviteCheck, createInvite, parseListingId, removeBroker, requestVerification, revokeInvite, saveBrokerProfile } from "@mteam/db";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { readPhotos, uploadPhoto } from "./photos";
import { clientIp, currentUser, signInHere } from "./session";
import { siteUrl } from "./site-url";

// The form says the same with maxLength; this is the check that counts.
const BIO_MAX = 600;

const branchIdSchema = z.string().regex(/^[\w-]{1,40}$/).nullable().catch(null);
const tokenSchema = z.string().max(100).catch("");
const inviteIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
const userIdSchema = z.string().regex(/^[\w-]{1,40}$/);
// A browser sends each line break as two characters; counted as one, as the form's own counter does.
const bioSchema = z
  .string()
  .transform((bio) => bio.replace(/\r\n/g, "\n").trim())
  .pipe(z.string().max(BIO_MAX));

const refresh = () => revalidatePath("/", "layout");

async function adminUser() {
  const user = await currentUser();
  if (user?.role !== "ADMIN") notFound();
  return user;
}

export interface InviteState {
  link?: string;
  failed?: boolean;
}

/** Makes an invite link and returns it once, for the admin to copy. */
export async function createInviteAction(_previous: InviteState, form: FormData): Promise<InviteState> {
  const admin = await adminUser();
  const locale = resolveLocale(String(form.get("locale")));
  try {
    const token = await createInvite(admin.id, branchIdSchema.parse(form.get("branchId") || null));
    refresh();
    return { link: `${siteUrl()}/${locale}/invite/${token}` };
  } catch (error) {
    console.error(error);
    return { failed: true };
  }
}

export async function revokeInviteAction(form: FormData): Promise<void> {
  await adminUser();
  const id = inviteIdSchema.safeParse(form.get("id"));
  if (id.success) await revokeInvite(id.data);
  refresh();
}

export async function removeBrokerAction(form: FormData): Promise<void> {
  await adminUser();
  const userId = userIdSchema.safeParse(form.get("userId"));
  if (userId.success) await removeBroker(userId.data);
  refresh();
}

/** Uses an invite and opens the new broker's profile. Anything else goes back to the invite page, which says why. */
export async function acceptInviteAction(form: FormData): Promise<void> {
  const locale = resolveLocale(String(form.get("locale")));
  const token = tokenSchema.parse(form.get("token"));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  if ((await claimInviteCheck(await clientIp())) && (await acceptInvite(user.id, token)) === "accepted") {
    refresh();
    redirect(`/${locale}/account/broker`);
  }
  redirect(`/${locale}/invite/${encodeURIComponent(token)}`);
}

export interface BrokerProfileState {
  saved?: boolean;
  badPhoto?: boolean;
  badBio?: boolean;
  failed?: boolean;
}

/** Saves a broker's bio, and a new photo when one was chosen. */
export async function saveBrokerProfileAction(_previous: BrokerProfileState, form: FormData): Promise<BrokerProfileState> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  if (user.role !== "AGENT" || !user.agent) notFound();
  const bio = bioSchema.safeParse(form.get("bio") ?? "");
  if (!bio.success) return { badBio: true };
  const file = form.get("photo");
  try {
    let photoUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      const photos = await readPhotos([file]);
      if (!photos) return { badPhoto: true };
      photoUrl = await uploadPhoto(photos[0]);
    }
    await saveBrokerProfile(user.agent.id, bio.data, photoUrl);
  } catch (error) {
    console.error(error);
    return { failed: true };
  }
  refresh();
  return { saved: true };
}

export interface VerifyState {
  sent?: boolean;
  failed?: boolean;
}

/** The owner's "Ask MTeam to verify". The database checks the listing is theirs and still qualifies. */
export async function requestVerifyAction(_previous: VerifyState, form: FormData): Promise<VerifyState> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  const listingId = parseListingId(String(form.get("listingId")));
  try {
    return listingId !== null && (await requestVerification(user.id, listingId)) ? { sent: true } : { failed: true };
  } catch (error) {
    console.error(error);
    return { failed: true };
  }
}
