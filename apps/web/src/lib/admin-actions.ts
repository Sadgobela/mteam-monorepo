"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { markLeadContacted, parseListingId, resolveReport, reviewListing, verifyListing } from "@mteam/db";
import { z } from "zod";
import { currentUser } from "./session";

async function staffUser() {
  const user = await currentUser();
  if (!user || user.role === "USER") notFound();
  return user;
}

const refresh = () => revalidatePath("/", "layout");

export async function resolveReportAction(form: FormData): Promise<void> {
  const user = await staffUser();
  if (user.role !== "ADMIN") notFound();
  await resolveReport(String(form.get("reportId")));
  refresh();
}

const reviewSchema = z.object({ listingId: z.string(), decision: z.enum(["ACTIVE", "REJECTED"]), editedAt: z.iso.datetime() });

export async function reviewListingAction(form: FormData): Promise<void> {
  const user = await staffUser();
  if (user.role !== "ADMIN") notFound();
  const input = reviewSchema.safeParse(Object.fromEntries(form));
  const id = input.success ? parseListingId(input.data.listingId) : null;
  // A decision names the version it was made on, so an edit that came in meanwhile stays in the queue.
  if (input.success && id !== null) await reviewListing(id, input.data.decision, new Date(input.data.editedAt));
  refresh();
}

export async function verifyListingAction(form: FormData): Promise<void> {
  const user = await staffUser();
  const id = parseListingId(String(form.get("listingId")));
  if (id !== null && user.agent) await verifyListing(user.agent.id, id);
  refresh();
}

export async function markLeadContactedAction(form: FormData): Promise<void> {
  await staffUser();
  const id = String(form.get("leadId"));
  if (/^\w{1,40}$/.test(id)) await markLeadContacted(id);
  refresh();
}
