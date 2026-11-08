"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveListing, parseListingId, setFavorite } from "@mteam/db";
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

export async function setFavoriteAction(form: FormData): Promise<void> {
  const want = form.get("want") === "1";
  await run(form, (userId, listingId) => setFavorite(userId, listingId, want));
}

export async function archiveListingAction(form: FormData): Promise<void> {
  await run(form, archiveListing);
}
