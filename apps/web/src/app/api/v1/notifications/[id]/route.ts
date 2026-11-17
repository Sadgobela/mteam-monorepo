import { NextResponse } from "next/server";
import { openNotification } from "@mteam/db";
import { defaultLocale, isLocale } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { noticeTarget } from "@/lib/notice-target";
import { currentUser } from "@/lib/session";

const schema = z.object({ locale: z.string().default("") });

/**
 * Marks one notification read and answers with the site path it leads to, as the site's notifications page follows it;
 * the app opens its own screen for that path. Someone else's notification is not found.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const body = await readJson(request, schema);
  if (!body) return fail("invalid", 400);
  const notice = await openNotification(user.id, (await params).id);
  if (!notice) return fail("notFound", 404);
  return NextResponse.json({ path: await noticeTarget(user.id, isLocale(body.locale) ? body.locale : defaultLocale, notice) });
}
