import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { signInWithIdentity } from "@mteam/db";
import { defaultLocale, isLocale, type Locale } from "@mteam/shared";
import { z } from "zod";
import { loginPath, safeNext } from "./login-path";
import { providerFlow } from "./oauth";
import { sessionCookie } from "./session";
import { siteUrl } from "./site-url";

const TEN_MINUTES = 10 * 60;

/**
 * Holds this sign-in's checks between leaving for the provider and coming back. Live, the __Host- name makes the browser
 * refuse one planted from another subdomain or over plain http, which would let someone finish their own sign-in in a
 * visitor's browser. That name needs Secure and the whole site as its path; locally there is no https.
 */
function pendingCookie() {
  const live = process.env.NODE_ENV === "production";
  return live ? { name: "__Host-mteam_social", path: "/", secure: true } : { name: "mteam_social", path: "/api/auth", secure: false };
}

const pendingSchema = z.object({
  provider: z.string(),
  state: z.string().min(1),
  nonce: z.string(),
  verifier: z.string(),
  next: z.string(),
  locale: z.string(),
});

/** The language to come back in. Georgian when missing: this is an address, not a page that could show a 404. */
const localeOf = (value: unknown): Locale => (typeof value === "string" && isLocale(value) ? value : defaultLocale);
const random = () => randomBytes(32).toString("base64url");
const redirectUri = (provider: string) => `${siteUrl()}/api/auth/${provider}/callback`;
// Compared as digests, which always have the same length, so no input can make the comparison throw.
const digest = (value: string) => createHash("sha256").update(value).digest();
const sameText = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** Leaves for the provider's sign-in page, remembering where to come back to. */
export async function startSocialLogin(request: NextRequest, provider: string): Promise<NextResponse> {
  const flow = providerFlow(provider);
  if (!flow) return new NextResponse(null, { status: 404 });
  const query = request.nextUrl.searchParams;
  const locale = localeOf(query.get("locale"));
  const pending = { provider, state: random(), nonce: random(), verifier: random(), next: safeNext(query.get("next"), locale), locale };
  const response = NextResponse.redirect(flow.authorizeUrl({ ...pending, redirectUri: redirectUri(provider) }));
  const { name, path, secure } = pendingCookie();
  // Lax still comes along on the provider's redirect back, which is a top-level GET.
  response.cookies.set(name, JSON.stringify(pending), { httpOnly: true, sameSite: "lax", secure, path, maxAge: TEN_MINUTES });
  return response;
}

function readPending(request: NextRequest) {
  try {
    return pendingSchema.parse(JSON.parse(String(request.cookies.get(pendingCookie().name)?.value)));
  } catch {
    return null;
  }
}

/** Back from the provider: checks this is the sign-in we started, then signs in and opens the page it was started from. */
export async function finishSocialLogin(request: NextRequest, provider: string): Promise<NextResponse> {
  const pending = readPending(request);
  const query = request.nextUrl.searchParams;
  const locale = localeOf(pending?.locale);
  const flow = providerFlow(provider);
  const code = query.get("code");
  // On failure, sign-in again, still coming back to the same page.
  let next = `${loginPath(locale, safeNext(pending?.next, locale))}&failed=social`;
  let token: string | null = null;

  // The state must be the one this browser set off with, or someone else's sign-in could be finished here.
  if (pending && flow && code && pending.provider === provider && sameText(pending.state, String(query.get("state")))) {
    try {
      const person = await flow.person(code, { ...pending, redirectUri: redirectUri(provider) });
      token = await signInWithIdentity(flow.id, person.subject);
      next = safeNext(pending.next, locale);
    } catch (error) {
      console.error("Social sign-in failed", provider, error);
    }
  }

  const response = NextResponse.redirect(new URL(next, siteUrl()));
  const { name, path } = pendingCookie();
  response.cookies.set(name, "", { path, maxAge: 0 });
  if (token) response.cookies.set(...sessionCookie(token));
  return response;
}
