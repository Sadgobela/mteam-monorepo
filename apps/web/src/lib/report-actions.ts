"use server";

import { parseListingId, reportListing } from "@mteam/db";
import { parseReport } from "@mteam/shared";
import { clientIp } from "./session";

export interface ReportState {
  sent?: boolean;
  invalid?: boolean;
}

export async function reportListingAction(_previous: ReportState, form: FormData): Promise<ReportState> {
  const listingId = parseListingId(String(form.get("listingId")));
  const report = parseReport(Object.fromEntries(form));
  if (listingId === null || !report) return { invalid: true };
  await reportListing(listingId, report, await clientIp());
  return { sent: true };
}
