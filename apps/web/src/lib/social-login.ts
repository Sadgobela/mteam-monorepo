import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { signInWithIdentity } from "@mteam/db";
import { defaultLocale, isLocale, type Locale } from "@mteam/shared";
import { z } from "zod";
import { safeNext } from "./login-path";
import { providerFlow } from "./oauth";
import { sessionCookie } from "./session";
import { siteUrl } from "./site-url";

/** Holds this sign-in's checks between leaving for the provider and coming back. Only our routes under /api/auth read it. */
const COOKIE = "mteam_social";
const COOKIE_PATH = "/api/auth";
const TEN_MINUTES = 10 * 60;

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
const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Leaves for the provider's sign-in page, remembering where to come back to. */
export async function startSocialLogin(request: NextRequest, provider: string): Promise<NextResponse> {
  const flow = providerFlow(provider);
  if (!flow) return new NextResponse(null, { status: 404 });
  const query = request.nextUrl.searchParams;
  const locale = localeOf(query.get("locale"));
  const pending = { provider, state: random(), nonce: random(), verifier: random(), next: safeNext(query.get("next"), locale), locale };
  const response = NextResponse.redirect(flow.authorizeUrl({ ...pending, redirectUri: redirectUri(provider) }));
  response.cookies.set(COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    // Lax still comes along on the provider's redirect back, which is a top-level GET.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: TEN_MINUTES,
  });
  return response;
}

function readPending(request: NextRequest) {
  try {
    return pendingSchema.parse(JSON.parse(String(request.cookies.get(COOKIE)?.value)));
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
  let next = `/${locale}/login?failed=social`;
  let token: string | null = null;

  // The state must be the one this browser set off with, or someone else's sign-in could be finished here.
  if (pending && flow && code && pending.provider === provider && sameText(pending.state, String(query.get("state")))) {
    try {
      const person = await flow.person(code, { ...pending, redirectUri: redirectUri(provider) });
      token = await signInWithIdentity(flow.id, person.subject, person.name);
      next = safeNext(pending.next, locale);
    } catch (error) {
      console.error("Social sign-in failed", provider, error);
    }
  }

  const response = NextResponse.redirect(new URL(next, siteUrl()));
  response.cookies.set(COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  if (token) response.cookies.set(...sessionCookie(token));
  return response;
}
