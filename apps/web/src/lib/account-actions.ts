"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveListing, parseListingId, toggleFavorite } from "@mteam/db";
import { resolveLocale } from "./locale";
import { currentUser } from "./session";

async function run(form: FormData, action: (userId: string, listingId: number) => Promise<void>): Promise<void> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const listingId = parseListingId(String(form.get("listingId")));
  if (listingId !== null) await action(user.id, listingId);
  revalidatePath("/", "layout");
}

export async function toggleFavoriteAction(form: FormData): Promise<void> {
  await run(form, toggleFavorite);
}

export async function archiveListingAction(form: FormData): Promise<void> {
  await run(form, archiveListing);
}
