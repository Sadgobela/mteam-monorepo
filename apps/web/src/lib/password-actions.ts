"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { changePassword, claimEmailSend, createResetToken, registerWithPassword, requestEmailChange, resetPassword, signInWithPassword } from "@mteam/db";
import { getDictionary, type Locale } from "@mteam/shared";
import { sendEmail } from "./email";
import { resolveLocale } from "./locale";
import { safeNext } from "./login-path";
import { clientIp, currentUser, signInHere, startSession } from "./session";
import { siteUrl } from "./site-url";

export type AuthError = "invalidEmail" | "weakPassword" | "wrong" | "wrongCurrent" | "limited" | "taken" | "badLink";
export type AuthNotice = "linkSent" | "verifySent" | "passwordSaved";

export interface AuthState {
  error?: AuthError;
  notice?: AuthNotice;
  /** Set once signed in: the page to open next, always one of ours. */
  done?: string;
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
// Capped, so hashing what someone pastes stays cheap.
const typedPasswordSchema = z.string().max(128);
const newPasswordSchema = typedPasswordSchema.min(10).refine((password) => new Set(password).size > 1);
const tokenSchema = z.string().min(1).max(100);

const localeOf = (form: FormData) => resolveLocale(String(form.get("locale")));

function sendLink(locale: Locale, to: string, page: "verify" | "reset", token: string): void {
  const mail = getDictionary(locale).auth.mail;
  sendEmail({ to, subject: page === "verify" ? mail.verifySubject : mail.resetSubject, link: `${siteUrl()}/${locale}/auth/${page}?token=${token}` });
}

async function signedInUser(locale: Locale) {
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  return user;
}

export async function emailSignInAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidEmail" };
  const password = typedPasswordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: "wrong" };
  const result = await signInWithPassword(email.data, password.data, await clientIp());
  if ("error" in result) return { error: result.error };
  await startSession(result.token);
  // A full page load afterwards, as after the phone code: see loginAction.
  return { done: safeNext(form.get("next"), locale) };
}

export async function registerAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidEmail" };
  const password = newPasswordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: "weakPassword" };
  const result = await registerWithPassword(email.data, password.data, await clientIp());
  if ("error" in result) return { error: result.error };
  sendLink(locale, email.data, "verify", result.verifyToken);
  await startSession(result.token);
  return { done: safeNext(form.get("next"), locale) };
}

/** Sends a reset link. The answer is the same whether or not an account has the email. */
export async function forgotPasswordAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidEmail" };
  if (!(await claimEmailSend(await clientIp(), email.data))) return { error: "limited" };
  const token = await createResetToken(email.data);
  if (token) sendLink(locale, email.data, "reset", token);
  return { notice: "linkSent" };
}

/** Sets the new password from a reset link and signs in fresh: every other session has ended. */
export async function resetPasswordAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const password = newPasswordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: "weakPassword" };
  const token = tokenSchema.safeParse(form.get("token"));
  const session = token.success ? await resetPassword(token.data, password.data) : null;
  if (!session) return { error: "badLink" };
  await startSession(session);
  return { done: `/${locale}/account/security` };
}

/** Sends a confirmation link to a new address, or again to the current one. The account's email changes when it is opened. */
export async function changeEmailAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const user = await signedInUser(locale);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidEmail" };
  if (!(await claimEmailSend(await clientIp(), email.data))) return { error: "limited" };
  const token = await requestEmailChange(user.id, email.data);
  if (!token) return { error: "taken" };
  sendLink(locale, email.data, "verify", token);
  return { notice: "verifySent" };
}

/** Sets a first password or changes one, which needs the current one. Other devices are signed out. */
export async function changePasswordAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const user = await signedInUser(localeOf(form));
  const next = newPasswordSchema.safeParse(form.get("password"));
  if (!next.success) return { error: "weakPassword" };
  // Missing when the account has no password yet.
  const current = typedPasswordSchema.safeParse(form.get("current") ?? "");
  if (!current.success) return { error: "wrongCurrent" };
  const result = await changePassword(user.id, current.data, next.data);
  if ("error" in result) return { error: result.error === "wrong" ? "wrongCurrent" : "limited" };
  await startSession(result.token);
  return { notice: "passwordSaved" };
}
