import { NextResponse } from "next/server";
import { claimAvatarUpload, setAvatar } from "@mteam/db";
import sharp from "sharp";
import { oneAtATime, readPhotos, uploadPhoto } from "@/lib/photos";
import { currentUser } from "@/lib/session";

/** Enough for a sharp face at twice the largest size it is shown, and small to load. */
const SIDE_PX = 256;
/** Under the 4.5 MB a Vercel function accepts. The browser shrinks a photo to 1024 px first, so it is far below. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const fail = (error: "forbidden" | "signedOut" | "photo" | "tooMany", status: number) => NextResponse.json({ error }, { status });

/** Only our own pages may post here. A browser always sends Origin with a POST, so another site's form is refused. */
function fromOurSite(request: Request): boolean {
  const origin = URL.parse(request.headers.get("origin") ?? "");
  return origin !== null && origin.host === (request.headers.get("x-forwarded-host") ?? new URL(request.url).host);
}

async function readPhoto(request: Request): Promise<File | null> {
  try {
    const photo = (await request.formData()).get("photo");
    return photo instanceof File ? photo : null;
  } catch {
    return null;
  }
}

/**
 * A route rather than a Server Action, so its own size limit and the checks below run before the body is read: the
 * origin, session and size come first, so only a real account on our site can make the server hold an upload, and the
 * hourly limit caps what one account can store.
 */
export async function POST(request: Request) {
  if (!fromOurSite(request)) return fail("forbidden", 403);
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
    const url = await uploadPhoto({ bytes: new Uint8Array(square), type: "image/webp", ext: "webp", folder: "avatars" });
    await setAvatar(user.id, url);
    return NextResponse.json({ avatarUrl: url });
  } catch (error) {
    console.error(error);
    return fail("photo", 500);
  }
}
