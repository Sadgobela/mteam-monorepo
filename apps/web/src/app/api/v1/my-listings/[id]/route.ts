import { NextResponse } from "next/server";
import { deleteDraft, getEditableListing, parseListingId } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/**
 * One of the user's own listings as the posting form's values (every field, by name, blank where unset) and its photo
 * addresses, for editing. Sending them back to `POST /api/listings` with the `id` saves the edit. 404 for anyone else's.
 */
export async function GET(_request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const listing = await getEditableListing(user.id, (await params).id);
  return listing ? NextResponse.json(listing) : fail("notFound", 404);
}

/** Deletes one of the user's unfinished drafts. 404 for anything else. */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const id = parseListingId((await params).id);
  return id !== null && (await deleteDraft(user.id, id)) ? NextResponse.json({ ok: true }) : fail("notFound", 404);
}
