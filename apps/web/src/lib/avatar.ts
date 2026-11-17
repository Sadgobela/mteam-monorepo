import { NextResponse } from "next/server";
import { claimAvatarUpload, setAvatar } from "@mteam/db";
import sharp from "sharp";
import { oneAtATime, readPhotos, uploadPhoto } from "./photos";

/** Enough for a sharp face at twice the largest size it is shown, and small to load. */
const SIDE_PX = 256;
/** Under the 4.5 MB a Vercel function accepts. The browser and the app shrink a photo first, so it is far below. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export type AvatarError = "forbidden" | "signedOut" | "photo" | "tooMany";
export const avatarFail = (error: AvatarError, status: number) => NextResponse.json({ error }, { status });

async function readPhoto(request: Request): Promise<File | null> {
  try {
    const photo = (await request.formData()).get("photo");
    return photo instanceof File ? photo : null;
  } catch {
    return null;
  }
}

/**
 * Takes a signed-in user's new photo, from the site's profile page or the app. The size and the hourly limit come
 * before the body is read, so only a real account can make the server hold an upload, and one account stores little.
 */
export async function saveAvatarUpload(request: Request, userId: string): Promise<NextResponse> {
  const length = Number(request.headers.get("content-length"));
  if (!(length > 0) || length > MAX_BODY_BYTES) return avatarFail("photo", 413);
  if (!(await claimAvatarUpload(userId))) return avatarFail("tooMany", 429);

  const file = await readPhoto(request);
  // Checked by content and re-encoded, which drops the location and other hidden fields.
  const [photo] = (file && (await readPhotos([file]))) || [];
  if (!photo) return avatarFail("photo", 422);

  try {
    const square = await oneAtATime(() => sharp(photo.thumb).resize(SIDE_PX, SIDE_PX, { fit: "cover" }).webp({ quality: 82 }).toBuffer());
    const url = await uploadPhoto({ bytes: new Uint8Array(square), type: "image/webp", ext: "webp", folder: "avatars" });
    await setAvatar(userId, url);
    return NextResponse.json({ avatarUrl: url });
  } catch (error) {
    console.error(error);
    return avatarFail("photo", 500);
  }
}
