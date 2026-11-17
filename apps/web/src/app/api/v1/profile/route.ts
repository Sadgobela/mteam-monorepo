import { NextResponse } from "next/server";
import { getProfile, updateProfile } from "@mteam/db";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** The same rules as the site's profile form: a name others will read, and what brings the user here. */
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[^\p{C}]+$/u),
  intent: z.enum(["SEEKING", "OWNER", "BROKER"]),
});

/** The signed-in user's name, photo, intent and the day they joined, as on the site's profile page. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const profile = await getProfile(user.id);
  return NextResponse.json({ ...profile, createdAt: profile.createdAt.toISOString() });
}

/** Saves the name and intent. Choosing BROKER only records the wish, as on the site. */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, schema);
  if (!body) return fail("invalid", 422);
  await updateProfile(user.id, body);
  return NextResponse.json({ ok: true });
}
