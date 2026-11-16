import { NextResponse } from "next/server";
import { claimPhoneLookup, countPhoneReveal, getListing } from "@mteam/db";
import { clientIp } from "@/lib/session";

/**
 * Only for published listings. `getListing` turns anything else, malformed ids included, into not found.
 * A hidden number is not found too, so buyers write through chat; every number shown counts as a reveal for the owner.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await claimPhoneLookup(await clientIp()))) return NextResponse.json({ error: "tooMany" }, { status: 429 });
  const listing = await getListing((await params).id);
  if (!listing || !(await countPhoneReveal(listing.id))) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return NextResponse.json({ phone: listing.contactPhone });
}
