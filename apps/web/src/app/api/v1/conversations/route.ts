import { NextResponse } from "next/server";
import { listConversations, parseListingId, startConversation } from "@mteam/db";
import { parseMessage } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

const startSchema = z.object({ listingId: z.union([z.number(), z.string()]), body: z.unknown() });

/** The user's chats, the latest activity first, as on the site's messages page. Names only, no phone numbers. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const rows = await listConversations(user.id);
  return NextResponse.json({ conversations: rows.map((row) => ({ ...row, lastAt: row.lastAt.toISOString() })) });
}

/**
 * Writes to the seller of a published listing, in the chat this buyer already has about it or a new one. 422 `failed`
 * when it cannot be sent: the user's own listing, a listing no longer published, or too many messages lately.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const input = await readJson(request, startSchema);
  const listingId = input ? parseListingId(String(input.listingId)) : null;
  const body = input ? parseMessage(input.body) : null;
  if (listingId === null || body === null) return fail("invalid", 400);
  const id = await startConversation(user.id, listingId, body);
  return id === null ? fail("failed", 422) : NextResponse.json({ id });
}
