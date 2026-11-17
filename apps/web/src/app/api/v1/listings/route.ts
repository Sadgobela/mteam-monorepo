import { NextResponse } from "next/server";
import { countListings, getGelPerUsd, PAGE_SIZE, searchListings } from "@mteam/db";
import { parseListingDisplay, parseListingFilters } from "@mteam/shared";
import { queryRecord, toPublicListing } from "@/lib/public-listing";

/** As many as the site's map shows at once. */
const MAP_LISTINGS = 200;

/**
 * Search for the mobile app: the same filters and sort as the site's results page, read from the same URL parameters.
 * `view=map` returns only listings with a location, up to the map's limit, on one page.
 */
export async function GET(request: Request) {
  const query = queryRecord(new URL(request.url).searchParams);
  const filters = parseListingFilters(query);
  const { sort, page, view } = parseListingDisplay(query);
  const isMap = view === "map";
  const [listings, total, gelPerUsd] = await Promise.all([
    searchListings(filters, isMap ? { sort, limit: MAP_LISTINGS, located: true } : { sort, page }),
    countListings(filters, { located: isMap }),
    getGelPerUsd(),
  ]);
  return NextResponse.json({
    listings: listings.map(toPublicListing),
    total,
    page: isMap ? 1 : page,
    pageSize: isMap ? MAP_LISTINGS : PAGE_SIZE,
    gelPerUsd,
  });
}
