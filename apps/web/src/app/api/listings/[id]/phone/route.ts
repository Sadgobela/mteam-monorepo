import { NextResponse } from "next/server";
import { claimPhoneLookup, getListing } from "@mteam/db";
import { clientIp } from "@/lib/session";

/** Only for published listings. `getListing` turns anything else, malformed ids included, into not found. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await claimPhoneLookup(await clientIp()))) return NextResponse.json({ error: "tooMany" }, { status: 429 });
  const listing = await getListing((await params).id);
  if (!listing) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return NextResponse.json({ phone: listing.contactPhone });
}
