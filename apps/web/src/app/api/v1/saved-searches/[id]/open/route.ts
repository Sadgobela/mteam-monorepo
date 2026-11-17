import { NextResponse } from "next/server";
import { openSavedSearch } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** Counts a saved search's results as seen and answers with its filters, which the app searches with. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const query = await openSavedSearch(user.id, (await params).id);
  return query === null ? fail("notFound", 404) : NextResponse.json({ query });
}
