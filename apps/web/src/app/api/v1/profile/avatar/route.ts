import { avatarFail, saveAvatarUpload } from "@/lib/avatar";
import { currentUser } from "@/lib/session";

/**
 * The app's photo upload, a form with one `photo`, answering `{ avatarUrl }`. The app signs in with a bearer token,
 * which another site cannot send, so unlike the site's own route it needs no origin check.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return avatarFail("signedOut", 401);
  return saveAvatarUpload(request, user.id);
}
