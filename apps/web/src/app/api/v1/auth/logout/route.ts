import { NextResponse } from "next/server";
import { deleteSession } from "@mteam/db";
import { sessionToken } from "@/lib/session";

/** Ends the app's session. Signing out twice, or without a session, is not an error. */
export async function POST() {
  const token = await sessionToken();
  if (token) await deleteSession(token);
  return NextResponse.json({ ok: true });
}
