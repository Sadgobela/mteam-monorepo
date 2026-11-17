import { NextResponse } from "next/server";
import { priceStats } from "@mteam/db";
import { METRO_CITY, parseListingFilters } from "@mteam/shared";
import { queryRecord } from "@/lib/public-listing";

/**
 * Typical apartment prices per m² by district and room count (`?city=&deal=sale|rent`), as on the site's prices page.
 * Anything else asks for Tbilisi sales. A room count of 4 means four or more.
 */
export async function GET(request: Request) {
  const filters = parseListingFilters(queryRecord(new URL(request.url).searchParams));
  const city = filters.city ?? METRO_CITY;
  const deal = filters.deal === "rent" ? "rent" : "sale";
  return NextResponse.json({ city, deal, stats: await priceStats(city, deal) });
}
