"use server";

import { redirect } from "next/navigation";
import { requestLoginCode, verifyLoginCode } from "@mteam/db";
import { parsePhone } from "@mteam/shared";
import { resolveLocale } from "./locale";
import { endSession, startSession } from "./session";

export type LoginError = "invalidPhone" | "tooSoon" | "wrongCode";

export interface LoginState {
  /** Set once a code has been requested: the form then asks for the code. */
  phone?: string;
  error?: LoginError;
}

export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  if (form.has("change")) return {};

  const phone = parsePhone(String(form.get("phone")));
  if (!phone) return { error: "invalidPhone" };

  const code = form.get("code");
  if (typeof code !== "string") {
    return (await requestLoginCode(phone)) ? { phone } : { phone, error: "tooSoon" };
  }

  const token = await verifyLoginCode(phone, code);
  if (!token) return { phone, error: "wrongCode" };

  await startSession(token);
  redirect(`/${resolveLocale(String(form.get("locale")))}/listings/new`);
}

export async function logoutAction(form: FormData): Promise<void> {
  await endSession();
  redirect(`/${resolveLocale(String(form.get("locale")))}`);
}
