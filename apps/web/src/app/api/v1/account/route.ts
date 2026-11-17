import { NextResponse } from "next/server";
import { deleteAccount } from "@mteam/db";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

const confirmSchema = z.object({ confirm: z.literal("yes") });

/**
 * Deletes a private person's account once they have confirmed (`{ confirm: "yes" }`), as the site's settings do. It ends
 * every session, this one included. 403 `staff` for brokers and admins, whom an admin removes.
 */
export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  if (!(await readJson(request, confirmSchema))) return fail("invalid", 400);
  if (user.role !== "USER" || !(await deleteAccount(user.id))) return fail("staff", 403);
  return NextResponse.json({ ok: true });
}
