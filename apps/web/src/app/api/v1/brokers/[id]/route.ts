import { NextResponse } from "next/server";
import { getBroker, getGelPerUsd } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";

/** One broker with their phone, photo, bio and live listings, as on their page on the site. 404 for anyone else. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const broker = await getBroker((await params).id);
  if (!broker) return fail("notFound", 404);
  const { listings, ...person } = broker;
  return NextResponse.json({ broker: person, listings: listings.map(toPublicListing), gelPerUsd: await getGelPerUsd() });
}
