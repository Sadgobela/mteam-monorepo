"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { markLeadContacted, parseListingId, resolveReport, reviewListing, verifyListing } from "@mteam/db";
import { currentUser } from "./session";

async function staffUser() {
  const user = await currentUser();
  if (!user || user.role === "USER") notFound();
  return user;
}

const refresh = () => revalidatePath("/", "layout");

export async function resolveReportAction(form: FormData): Promise<void> {
  await staffUser();
  await resolveReport(String(form.get("reportId")));
  refresh();
}

export async function reviewListingAction(form: FormData): Promise<void> {
  const user = await staffUser();
  if (user.role !== "ADMIN") notFound();
  const id = parseListingId(String(form.get("listingId")));
  const decision = form.get("decision");
  if (id !== null && (decision === "ACTIVE" || decision === "REJECTED")) await reviewListing(id, decision);
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
