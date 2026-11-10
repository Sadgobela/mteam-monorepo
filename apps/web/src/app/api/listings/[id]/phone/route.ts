import { NextResponse } from "next/server";
import { getListing } from "@mteam/db";

/** Only for published listings. `getListing` turns anything else, malformed ids included, into not found. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // ponytail: no rate limit, so a patient scraper can still walk ids. Add a per-address cap before launch.
  const listing = await getListing((await params).id);
  if (!listing) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return NextResponse.json({ phone: listing.contactPhone });
}
