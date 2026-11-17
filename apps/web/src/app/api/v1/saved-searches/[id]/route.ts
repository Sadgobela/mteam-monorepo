import { NextResponse } from "next/server";
import { deleteSavedSearch } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** Forgets one of the user's saved searches; someone else's is left alone. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  await deleteSavedSearch(user.id, (await params).id);
  return NextResponse.json({ ok: true });
}
