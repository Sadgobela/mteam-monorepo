import { NextResponse } from "next/server";
import { getFavoriteIds } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** The signed-in user, with the ids of their favourites so the app can fill in the hearts. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  return NextResponse.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    onboarded: user.onboardedAt !== null,
    favoriteIds: await getFavoriteIds(user.id),
  });
}
