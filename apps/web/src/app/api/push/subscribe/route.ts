import { NextResponse } from "next/server";
import { savePushSubscription } from "@mteam/db";
import { locales } from "@mteam/shared";
import { z } from "zod";
import { pushSubscriptionSchema } from "@/lib/push";
import { isCrossSite } from "@/lib/same-origin";
import { currentUser } from "@/lib/session";

/** The browser's subscription and the language of the page it was turned on from, which the notifications are written in. */
const bodySchema = pushSubscriptionSchema.extend({ locale: z.enum(locales) });

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Turns push on for this browser, for the signed-in user. The per-user limit is kept by savePushSubscription. */
export async function POST(request: Request) {
  if (isCrossSite(request)) return fail("crossSite", 403);
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("invalid", 422);
  const { endpoint, keys, locale } = parsed.data;
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  await savePushSubscription(user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth, locale, userAgent });
  return NextResponse.json({ ok: true });
}
