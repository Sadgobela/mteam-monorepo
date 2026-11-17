import { NextResponse } from "next/server";
import { listBranches, listBrokers } from "@mteam/db";

/** MTeam's branches and brokers, as on the site's brokers page. The city is a place name the app writes in its language. */
export async function GET() {
  const [brokers, branches] = await Promise.all([listBrokers(), listBranches()]);
  return NextResponse.json({
    branches,
    // A broker's phone is public, but the list needs none: it is on each broker's own page.
    brokers: brokers.map(({ id, name, branch, listingCount }) => ({ id, name, branch, listingCount })),
  });
}
