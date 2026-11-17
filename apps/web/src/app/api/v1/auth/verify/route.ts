import { NextResponse } from "next/server";
import { getSessionUser, verifyLoginCode } from "@mteam/db";
import { parsePhone } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { userAgent } from "@/lib/session";

const schema = z.object({ phone: z.string().max(40), code: z.string().max(10) });

/**
 * Checks the code and opens a session, whose token the app keeps in its secure store and sends as a bearer token.
 * `onboarded` tells the app whether to ask the first-visit questions next.
 */
export async function POST(request: Request) {
  const body = await readJson(request, schema);
  const phone = body && parsePhone(body.phone);
  if (!body || !phone) return fail("invalidPhone", 400);
  const token = await verifyLoginCode(phone, body.code, await userAgent());
  if (!token) return fail("wrongCode", 401);
  const user = await getSessionUser(token);
  return NextResponse.json({ token, onboarded: Boolean(user?.onboardedAt) });
}
