import { NextResponse } from "next/server";
import { getConversation, sendMessage } from "@mteam/db";
import { parseMessage } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };
const sendSchema = z.object({ body: z.unknown() });

/** One chat, oldest message first, which marks it read for this user. 404 unless they are in it. */
export async function GET(_request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const chat = await getConversation(user.id, (await params).id);
  if (!chat) return fail("notFound", 404);
  return NextResponse.json({ ...chat, messages: chat.messages.map((message) => ({ ...message, at: message.at.toISOString() })) });
}

/** Writes in a chat the user is in. 422 `failed` when it cannot be sent, as on the site. */
export async function POST(request: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const input = await readJson(request, sendSchema);
  const body = input ? parseMessage(input.body) : null;
  if (body === null) return fail("invalid", 400);
  return (await sendMessage(user.id, (await params).id, body)) ? NextResponse.json({ ok: true }) : fail("failed", 422);
}
