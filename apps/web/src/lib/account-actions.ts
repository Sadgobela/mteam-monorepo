"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveListing, deleteSavedSearch, openSavedSearch, parseListingId, saveSearch, setFavorite, setHidden } from "@mteam/db";
import { canonicalSearch } from "@mteam/shared";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { currentUser, signInHere } from "./session";

async function run(form: FormData, action: (userId: string, listingId: number) => Promise<void>): Promise<void> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  const listingId = parseListingId(String(form.get("listingId")));
  if (listingId !== null) await action(user.id, listingId);
  revalidatePath("/", "layout");
}

export async function setFavoriteAction(form: FormData): Promise<void> {
  const want = form.get("want") === "1";
  await run(form, (userId, listingId) => setFavorite(userId, listingId, want));
}

export async function setHiddenAction(form: FormData): Promise<void> {
  const want = form.get("want") === "1";
  await run(form, (userId, listingId) => setHidden(userId, listingId, want));
}

/** The signed-in user and the language, or off to the sign-in page. */
async function signedIn(form: FormData) {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  return { locale, user };
}

const savedSearchIdSchema = z.string().regex(/^[\w-]{1,40}$/).catch("");
const savedSearchId = (form: FormData) => savedSearchIdSchema.parse(form.get("id"));

export async function saveSearchAction(form: FormData): Promise<void> {
  const { locale, user } = await signedIn(form);
  const query = canonicalSearch(Object.fromEntries(new URLSearchParams(String(form.get("query")))));
  // At the limit the list is where one can be removed to make room.
  if (query && !(await saveSearch(user.id, query))) redirect(`/${locale}/saved`);
  revalidatePath("/", "layout");
}

export async function deleteSavedSearchAction(form: FormData): Promise<void> {
  const { user } = await signedIn(form);
  await deleteSavedSearch(user.id, savedSearchId(form));
  revalidatePath("/", "layout");
}

/** Counts its results as seen, then shows them. */
export async function openSavedSearchAction(form: FormData): Promise<void> {
  const { locale, user } = await signedIn(form);
  const query = await openSavedSearch(user.id, savedSearchId(form));
  redirect(query === null ? `/${locale}/saved` : `/${locale}?${query}`);
}

export async function archiveListingAction(form: FormData): Promise<void> {
  await run(form, archiveListing);
}
