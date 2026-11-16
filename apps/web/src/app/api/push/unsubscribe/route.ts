import { NextResponse } from "next/server";
import { deletePushSubscription } from "@mteam/db";
import { z } from "zod";
import { isCrossSite } from "@/lib/same-origin";
import { currentUser } from "@/lib/session";

const bodySchema = z.object({ endpoint: z.url().max(1024) });

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Turns push off for this browser. Only the signed-in user's own: someone else's address changes nothing. */
export async function POST(request: Request) {
  if (isCrossSite(request)) return fail("crossSite", 403);
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("invalid", 422);
  await deletePushSubscription(user.id, parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
