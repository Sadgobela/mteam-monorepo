import { NextResponse } from "next/server";
import { claimAvatarUpload, setAvatar } from "@mteam/db";
import { MAX_PHOTO_BYTES } from "@mteam/shared";
import sharp from "sharp";
import { oneAtATime, readPhotos, uploadPhoto } from "@/lib/photos";
import { currentUser } from "@/lib/session";

/** Enough for a sharp face at twice the largest size it is shown, and small to load. */
const SIDE_PX = 256;
/** One photo at its limit plus the form's framing. */
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

const fail = (error: "signedOut" | "photo" | "tooMany", status: number) => NextResponse.json({ error }, { status });

async function readPhoto(request: Request): Promise<File | null> {
  try {
    const photo = (await request.formData()).get("photo");
    return photo instanceof File ? photo : null;
  } catch {
    return null;
  }
}

/**
 * A route instead of a Server Action, whose size limit is too small for a phone photo. The session and size checks come
 * first, so only a real account can make the server hold an upload; the hourly limit caps what one account can store.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);

  const length = Number(request.headers.get("content-length"));
  if (!(length > 0) || length > MAX_BODY_BYTES) return fail("photo", 413);
  if (!(await claimAvatarUpload(user.id))) return fail("tooMany", 429);

  const file = await readPhoto(request);
  // Checked by content and re-encoded, which drops the location and other hidden fields.
  const [photo] = (file && (await readPhotos([file]))) || [];
  if (!photo) return fail("photo", 422);

  try {
    const square = await oneAtATime(() => sharp(photo.thumb).resize(SIDE_PX, SIDE_PX, { fit: "cover" }).webp({ quality: 82 }).toBuffer());
    const url = await uploadPhoto({ bytes: new Uint8Array(square), thumb: new Uint8Array(square), type: "image/webp", ext: "webp" });
    await setAvatar(user.id, url);
    return NextResponse.json({ avatarUrl: url });
  } catch (error) {
    console.error(error);
    return fail("photo", 500);
  }
}
