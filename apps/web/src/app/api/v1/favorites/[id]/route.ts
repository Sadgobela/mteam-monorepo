import { NextResponse } from "next/server";
import { parseListingId, setFavorite } from "@mteam/db";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";

const schema = z.object({ favorite: z.boolean() });

/** Sets the heart to the state asked for, so a repeated request cannot undo it. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const id = parseListingId((await params).id);
  const body = await readJson(request, schema);
  if (id === null || !body) return fail("invalid", 400);
  await setFavorite(user.id, id, body.favorite);
  return NextResponse.json({ id, favorite: body.favorite });
}
