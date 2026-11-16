import { NextResponse } from "next/server";
import { createListing, getEditableListing, photosOfOthers, saveDraft, updateListing } from "@mteam/db";
import { MAX_PHOTOS, parseDraftProgress, parseListingDraft } from "@mteam/shared";
import { streetsIn } from "@mteam/shared/streets";
import { z } from "zod";
import { isUploadedPhoto } from "@/lib/photos";
import { currentUser } from "@/lib/session";

/** The text fields only: photos go up one by one to `/api/listings/photos` and arrive here as their addresses. */
const MAX_BODY_BYTES = 256 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const controlSchema = z.object({
  intent: z.enum(["draft", "submit"]),
  // Blank for a new listing.
  id: z.string().max(12).default(""),
});

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * Saves the posting form. Without an id it creates a listing; with one it edits the user's own. "draft" autosaves an unfinished
 * DRAFT, "submit" sends the listing for review (see `updateListing` for when an edit stays live).
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  // The phone is the listing's contact number. The posting page asks for one first, so this only stops a crafted request.
  if (!user.phone) return fail("noPhone", 403);

  const length = Number(request.headers.get("content-length"));
  if (!(length > 0) || length > MAX_BODY_BYTES) return fail("invalid", 413);

  const form = await readForm(request);
  const fields = form ? Object.fromEntries(form) : {};
  const control = controlSchema.safeParse(fields);
  if (!form || !control.success) return fail("invalid", 400);
  const { intent, id: rawId } = control.data;

  const existing = rawId ? await getEditableListing(user.id, rawId) : null;
  if (rawId && !existing) return fail("missing", 404);
  const id = existing?.id ?? null;
  // A broker's listing is the broker's to handle, and never expires. The role is checked too, as a broker can lose it.
  const agentId = user.role === "AGENT" ? (user.agent?.id ?? null) : null;

  try {
    // An edit may keep the photos the listing already has; anything else must be one of our own uploads, each once, and not
    // one already shown on someone else's listing.
    const photos = form.getAll("photos").map(String);
    const known = new Set(existing?.images);
    if (
      photos.length > MAX_PHOTOS ||
      new Set(photos).size !== photos.length ||
      !photos.every((url) => known.has(url) || isUploadedPhoto(url)) ||
      (await photosOfOthers(user.id, photos))
    ) {
      return fail("photos", 422);
    }

    if (intent === "draft") {
      const progress = parseDraftProgress(fields);
      if (!progress) return fail("invalid", 422);
      const saved = await saveDraft(user.id, id, progress, photos, agentId);
      return saved === null ? fail("missing", 404) : NextResponse.json({ id: saved, status: "DRAFT" });
    }

    const draft = parseListingDraft(fields);
    if (!draft) return fail("invalid", 422);
    // Here rather than in the draft parser, which also runs in the browser and would pull the whole list into the page.
    if (draft.street && !streetsIn(draft.city, draft.district ? [draft.district] : []).includes(draft.street)) return fail("invalid", 422);
    if (photos.length === 0) return fail("photos", 422);

    if (id === null) return NextResponse.json({ id: await createListing(user.id, draft, photos, agentId), status: "PENDING" });
    const status = await updateListing(user.id, id, draft, photos);
    return status === null ? fail("missing", 404) : NextResponse.json({ id, status });
  } catch (error) {
    console.error(error);
    return fail("save", 500);
  }
}
