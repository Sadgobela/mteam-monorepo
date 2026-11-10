"use server";

import { redirect } from "next/navigation";
import { parseListingId, sendMessage, startConversation } from "@mteam/db";
import { parseMessage } from "@mteam/shared";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { currentUser } from "./session";

const conversationIdSchema = z.string().regex(/^[\w-]{1,40}$/).catch("");

export async function startChatAction(form: FormData): Promise<void> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const listingId = parseListingId(String(form.get("listingId")));
  if (listingId === null) redirect(`/${locale}`);
  const body = parseMessage(form.get("body"));
  const id = body === null ? null : await startConversation(user.id, listingId, body);
  redirect(id === null ? `/${locale}/listings/${listingId}?chat=failed` : `/${locale}/messages/${id}`);
}

export async function sendChatAction(form: FormData): Promise<void> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const id = conversationIdSchema.parse(form.get("conversationId"));
  const body = parseMessage(form.get("body"));
  const sent = body !== null && (await sendMessage(user.id, id, body));
  redirect(`/${locale}/messages/${id}${sent ? "" : "?failed=1"}`);
}
