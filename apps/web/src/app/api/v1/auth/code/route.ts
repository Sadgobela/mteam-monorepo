import { NextResponse } from "next/server";
import { requestLoginCode } from "@mteam/db";
import { parsePhone } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { clientIp } from "@/lib/session";

const schema = z.object({ phone: z.string().max(40) });

/** Sends a sign-in code by SMS, with the same limits as the site's sign-in form. */
export async function POST(request: Request) {
  const body = await readJson(request, schema);
  const phone = body && parsePhone(body.phone);
  if (!phone) return fail("invalidPhone", 400);
  if (!(await requestLoginCode(phone, await clientIp()))) return fail("tooSoon", 429);
  return NextResponse.json({ phone });
}
