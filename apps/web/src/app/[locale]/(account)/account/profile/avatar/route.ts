import { avatarFail, saveAvatarUpload } from "@/lib/avatar";
import { currentUser } from "@/lib/session";

/** Only our own pages may post here. A browser always sends Origin with a POST, so another site's form is refused. */
function fromOurSite(request: Request): boolean {
  const origin = URL.parse(request.headers.get("origin") ?? "");
  return origin !== null && origin.host === (request.headers.get("x-forwarded-host") ?? new URL(request.url).host);
}

/**
 * A route rather than a Server Action, so its own size limit and the checks run before the body is read: the origin
 * and session come first, then the checks in `saveAvatarUpload`.
 */
export async function POST(request: Request) {
  if (!fromOurSite(request)) return avatarFail("forbidden", 403);
  const user = await currentUser();
  if (!user) return avatarFail("signedOut", 401);
  return saveAvatarUpload(request, user.id);
}
