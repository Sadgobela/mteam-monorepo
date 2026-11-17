import type { Listing } from "@mteam/shared";

/** A listing as the app API sends it: without phone numbers, which are given out one at a time and counted (`/api/listings/[id]/phone`). */
export type PublicListing = Omit<Listing, "contactPhone" | "agent"> & { agent?: Omit<NonNullable<Listing["agent"]>, "phone"> };

export function toPublicListing(listing: Listing): PublicListing {
  const copy: Partial<Pick<Listing, "contactPhone">> & Omit<Listing, "contactPhone"> = { ...listing };
  delete copy.contactPhone;
  const { agent, ...rest } = copy;
  return agent ? { ...rest, agent: { id: agent.id, name: agent.name, branch: agent.branch } } : rest;
}

/** URL parameters in the shape the shared parsers read: a repeated name becomes a list. */
export function queryRecord(params: URLSearchParams): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const name of new Set(params.keys())) {
    const values = params.getAll(name);
    record[name] = values.length === 1 ? values[0] : values;
  }
  return record;
}
