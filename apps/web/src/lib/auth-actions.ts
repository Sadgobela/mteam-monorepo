"use server";

import { redirect } from "next/navigation";
import { addPhone, requestLoginCode, verifyLoginCode } from "@mteam/db";
import { parsePhone } from "@mteam/shared";
import { resolveLocale } from "./locale";
import { safeNext } from "./login-path";
import { clientIp, currentUser, endSession, signInHere, startSession } from "./session";

export type LoginError = "invalidPhone" | "tooSoon" | "wrongCode" | "phoneTaken";

export interface LoginState {
  /** Set once a code has been requested: the form then asks for the code. */
  phone?: string;
  error?: LoginError;
  /** Set once signed in: the page to open next, always one of ours. */
  done?: string;
}

export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  if (form.has("change")) return {};

  const phone = parsePhone(String(form.get("phone")));
  if (!phone) return { error: "invalidPhone" };

  const code = form.get("code");
  if (typeof code !== "string") {
    return (await requestLoginCode(phone, await clientIp())) ? { phone } : { phone, error: "tooSoon" };
  }

  const token = await verifyLoginCode(phone, code);
  if (!token) return { phone, error: "wrongCode" };

  await startSession(token);
  // A full page load afterwards, not a redirect: a redirect from the modal leaves Next holding the sign-in route
  // in its modal slot, and it would show again after signing out.
  return { done: safeNext(form.get("next"), resolveLocale(String(form.get("locale")))) };
}

/** Gives an account from Google, Facebook or Apple the checked phone that posting needs, in the same two steps. */
export async function addPhoneAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  // Added already, in another tab: nothing to do, and no SMS to send.
  if (user.phone) return { done: `/${locale}/listings/new` };
  if (form.has("change")) return {};

  const phone = parsePhone(String(form.get("phone")));
  if (!phone) return { error: "invalidPhone" };

  const code = form.get("code");
  if (typeof code !== "string") {
    return (await requestLoginCode(phone, await clientIp())) ? { phone } : { phone, error: "tooSoon" };
  }

  const result = await addPhone(user.id, phone, code);
  if (result === "added") return { done: `/${locale}/listings/new` };
  // A taken number cannot be fixed with another code, so this goes back to asking for a number.
  return result === "taken" ? { error: "phoneTaken" } : { phone, error: "wrongCode" };
}

export async function logoutAction(form: FormData): Promise<void> {
  await endSession();
  redirect(`/${resolveLocale(String(form.get("locale")))}`);
}
