import { NextResponse } from "next/server";
import { claimPhotoUpload } from "@mteam/db";
import { MAX_PHOTO_BYTES } from "@mteam/shared";
import { readPhotos, uploadPhoto } from "@/lib/photos";
import { currentUser } from "@/lib/session";

/** One photo at its limit, plus room for the form's framing. Still under Vercel's 4.5 MB for a function's body. */
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * Takes one photo of a listing and returns its address, which the listing form then sends with its fields. One per request,
 * because a whole set of photos would pass the size a function on Vercel accepts. The checks come before the body is read.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  if (!user.phone) return fail("noPhone", 403);

  const length = Number(request.headers.get("content-length"));
  if (!(length > 0) || length > MAX_BODY_BYTES) return fail("photos", 413);
  if (!(await claimPhotoUpload(user.id))) return fail("tooMany", 429);

  const file = (await readForm(request))?.get("photo");
  const photos = file instanceof File ? await readPhotos([file]) : null;
  if (!photos) return fail("photos", 422);

  try {
    return NextResponse.json({ url: await uploadPhoto(photos[0]) });
  } catch (error) {
    console.error(error);
    return fail("save", 500);
  }
}
