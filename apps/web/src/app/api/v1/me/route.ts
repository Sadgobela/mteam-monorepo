import { NextResponse } from "next/server";
import { countUnreadNotifications, getFavoriteIds } from "@mteam/db";
import { fail } from "@/lib/api";
import { currentUser } from "@/lib/session";

/**
 * The signed-in user, with the ids of their favourites so the app can fill in the hearts, unread notifications for its
 * badge, and the broker they are (if any), so the app does not offer writing about their own agency's listings.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const [favoriteIds, unread] = await Promise.all([getFavoriteIds(user.id), countUnreadNotifications(user.id)]);
  return NextResponse.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    agentId: user.agent?.id ?? null,
    onboarded: user.onboardedAt !== null,
    favoriteIds,
    unread,
  });
}
