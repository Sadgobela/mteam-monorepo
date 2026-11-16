"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bumpListing, parseListingId, renewListing } from "@mteam/db";
import { resolveLocale } from "./locale";
import { currentUser, signInHere } from "./session";

/**
 * Signed in, a valid id, and the owner check inside the db write: a listing id from the form is never trusted on its own.
 * Whether it was done, so the page can say so: a bump within a day of the last one is refused.
 */
async function onOwnListing(form: FormData, action: (ownerId: string, listingId: number) => Promise<boolean>): Promise<boolean> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  const listingId = parseListingId(String(form.get("listingId")));
  const done = listingId !== null && (await action(user.id, listingId));
  // A bump or a renewal changes what search shows, not only this page.
  revalidatePath("/", "layout");
  return done;
}

export async function bumpListingAction(form: FormData): Promise<boolean> {
  return onOwnListing(form, (ownerId, listingId) => bumpListing(ownerId, listingId));
}

export async function renewListingAction(form: FormData): Promise<boolean> {
  return onOwnListing(form, (ownerId, listingId) => renewListing(ownerId, listingId));
}
