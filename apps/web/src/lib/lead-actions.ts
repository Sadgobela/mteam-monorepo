"use server";

import { createLead } from "@mteam/db";
import { parseLead } from "@mteam/shared";

export interface LeadState {
  sent?: boolean;
  invalid?: boolean;
}

export async function leadAction(_previous: LeadState, form: FormData): Promise<LeadState> {
  const lead = parseLead(Object.fromEntries(form));
  if (!lead) return { invalid: true };
  await createLead(lead);
  return { sent: true };
}
