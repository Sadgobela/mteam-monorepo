import type { Locale } from "@mteam/shared";
import { safeNext } from "./login-path";

/**
 * Pages a new account may open before onboarding: onboarding itself, a broker invite (it has its own flow), the email
 * links under /auth, and sign-in and security, where an email link or a password reset lands.
 */
const UNGUARDED = /^\/[a-z]{2}\/(?:onboarding|invite|auth|account\/security)(?:[/?#]|$)/;

/** Whether a new account may open this page (path, optionally with its query) before answering the first-visit questions. */
export const skipsOnboarding = (path: string) => UNGUARDED.test(path);

/** The first-visit questions, continuing to `next` afterwards. */
export const onboardingPath = (locale: Locale, next: string) => `/${locale}/onboarding?next=${encodeURIComponent(next)}`;

/** Where onboarding continues to: one of our pages, never onboarding again, which would go round in a circle. */
export function onboardingNext(value: unknown, locale: Locale): string {
  const next = safeNext(value, locale);
  return /^\/[a-z]{2}\/onboarding(?:[/?#]|$)/.test(next) ? `/${locale}` : next;
}

/**
 * Where to go right after signing in, by any method. A new account answers the first-visit questions first. Every
 * sign-in path calls this with the user its new session belongs to.
 */
export function pathAfterSignIn(user: { onboardedAt: Date | null } | null, next: string, locale: Locale): string {
  return user && !user.onboardedAt && !skipsOnboarding(next) ? onboardingPath(locale, next) : next;
}
