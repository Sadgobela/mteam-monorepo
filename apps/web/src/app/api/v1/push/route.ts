import { NextResponse } from "next/server";
import { deleteAppPushToken, saveAppPushToken } from "@mteam/db";
import { locales } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { expoPushTokenSchema } from "@/lib/app-push";
import { currentUser } from "@/lib/session";

const saveSchema = z.object({ token: expoPushTokenSchema, platform: z.enum(["ios", "android"]), locale: z.enum(locales) });
const deleteSchema = z.object({ token: expoPushTokenSchema });

/** Turns push on for this phone, in the app's language. The per-user limit is kept by saveAppPushToken. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, saveSchema);
  if (!body) return fail("invalid", 422);
  await saveAppPushToken(user.id, body);
  return NextResponse.json({ ok: true });
}

/** Turns push off for this phone, as the app does before signing out. */
export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, deleteSchema);
  if (!body) return fail("invalid", 422);
  await deleteAppPushToken(user.id, body.token);
  return NextResponse.json({ ok: true });
}
