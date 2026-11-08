"use server";

import { redirect } from "next/navigation";
import { createListing } from "@mteam/db";
import { parseListingDraft } from "@mteam/shared";
import { resolveLocale } from "./locale";
import { readPhotos, uploadPhoto } from "./photos";
import { currentUser } from "./session";

export type PostError = "invalid" | "photos" | "save";

export interface PostState {
  error?: PostError;
}

export async function createListingAction(_previous: PostState, form: FormData): Promise<PostState> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);

  const draft = parseListingDraft(Object.fromEntries(form));
  if (!draft) return { error: "invalid" };

  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const photos = await readPhotos(files);
  if (!photos) return { error: "photos" };

  // Upload before the insert: a failure leaves at most unused files, never a listing with missing photos.
  try {
    const imageUrls = await Promise.all(photos.map(uploadPhoto));
    await createListing(user.id, draft, imageUrls);
  } catch (error) {
    console.error(error);
    return { error: "save" };
  }

  redirect(`/${locale}/listings/new?sent=1`);
}
