import { cookies, headers } from "next/headers";
import { deleteSession, getSessionUser } from "@mteam/db";

const COOKIE = "mteam_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The signed-in user. Use this wherever access depends on the answer. */
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? getSessionUser(token) : null;
}

/** Only for choosing what the header shows: it saves a query but does not prove the session is valid. */
export async function hasSession(): Promise<boolean> {
  return (await cookies()).has(COOKIE);
}

/** Where a request came from. The last entry is the one our own proxy added; anything before it can be made up by the client. */
export async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  return forwarded.slice(forwarded.lastIndexOf(",") + 1).trim() || "unknown";
}

export async function startSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteSession(token);
  store.delete(COOKIE);
}
