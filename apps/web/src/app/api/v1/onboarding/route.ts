import { NextResponse } from "next/server";
import { completeOnboarding } from "@mteam/db";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

/** The same rules as the site's first-visit form: a name others will read, an intent, and the terms accepted. */
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[^\p{C}]+$/u),
  intent: z.enum(["SEEKING", "OWNER", "BROKER"]),
  terms: z.literal(true),
});

/** Saves the first-visit answers, which posting needs. Only the first answers count, as on the site. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, schema);
  if (!body) return fail("invalid", 422);
  await completeOnboarding(user.id, { name: body.name, intent: body.intent });
  return NextResponse.json({ ok: true });
}
