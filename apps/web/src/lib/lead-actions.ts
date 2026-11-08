"use server";

import { createLead } from "@mteam/db";
import { parseLead } from "@mteam/shared";

export interface LeadState {
  sent?: boolean;
  invalid?: boolean;
  failed?: boolean;
}

export async function leadAction(_previous: LeadState, form: FormData): Promise<LeadState> {
  const lead = parseLead(Object.fromEntries(form));
  if (!lead) return { invalid: true };
  try {
    await createLead(lead);
  } catch (error) {
    console.error(error);
    return { failed: true };
  }
  return { sent: true };
}
