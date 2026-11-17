import { NextResponse } from "next/server";
import { getPreferences, PREFERENCE_KEYS, setPreference } from "@mteam/db";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

const switchSchema = z.object({ key: z.enum(PREFERENCE_KEYS), value: z.boolean() });

/**
 * The account's switches, as on the site's settings page, and whether the user may delete the account here (private
 * people only: brokers and admins ask an admin).
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  return NextResponse.json({ preferences: await getPreferences(user.id), canDelete: user.role === "USER" });
}

/** Flips one switch: `{ key, value }`. */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, switchSchema);
  if (!body) return fail("invalid", 400);
  await setPreference(user.id, body.key, body.value);
  return NextResponse.json({ ok: true });
}
