import { NextResponse } from "next/server";
import { archiveListing, bumpListing, parseListingId, renewListing } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** What the owner can do with a listing, as on the site: each answers whether it was done. Taking one down always is. */
const actions = {
  bump: bumpListing,
  renew: renewListing,
  archive: async (ownerId: string, id: number) => {
    await archiveListing(ownerId, id);
    return true;
  },
} satisfies Record<string, (ownerId: string, id: number) => Promise<boolean>>;

/** `POST /api/v1/my-listings/<id>/bump|renew|archive`. 409 `failed` when it cannot be done now (bumped today, say). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const { id: raw, action } = await params;
  const id = parseListingId(raw);
  if (id === null || !Object.hasOwn(actions, action)) return fail("notFound", 404);
  return (await actions[action as keyof typeof actions](user.id, id)) ? NextResponse.json({ ok: true }) : fail("failed", 409);
}
