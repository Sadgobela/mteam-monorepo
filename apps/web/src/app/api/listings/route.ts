import { NextResponse } from "next/server";
import { createListing } from "@mteam/db";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, parseListingDraft } from "@mteam/shared";
import { readPhotos, uploadPhoto } from "@/lib/photos";
import { currentUser } from "@/lib/session";

/** Ten photos at their limit, plus room for the text fields and the form's framing. */
const MAX_BODY_BYTES = MAX_PHOTOS * MAX_PHOTO_BYTES + 5 * 1024 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * A route instead of a Server Action, because an action's size limit applies to the whole site and its body is read
 * before any code here runs. Both checks below come first, so only a real session can make the server hold a large upload.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);

  const length = Number(request.headers.get("content-length"));
  if (!(length > 0) || length > MAX_BODY_BYTES) return fail("photos", 413);

  const form = await readForm(request);
  if (!form) return fail("invalid", 400);

  const draft = parseListingDraft(Object.fromEntries(form));
  if (!draft) return fail("invalid", 422);

  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const photos = await readPhotos(files);
  if (!photos) return fail("photos", 422);

  // Upload before the insert: a failure leaves at most unused files, never a listing with missing photos.
  try {
    const imageUrls = await Promise.all(photos.map(uploadPhoto));
    await createListing(user.id, draft, imageUrls);
  } catch (error) {
    console.error(error);
    return fail("save", 500);
  }

  return NextResponse.json({});
}
