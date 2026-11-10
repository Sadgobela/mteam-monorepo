// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ parseListingId: vi.fn(), reportListing: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("./session", () => ({ clientIp: async () => "1.2.3.4" }));

import { reportListingAction } from "./report-actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => vi.clearAllMocks());

describe("reportListingAction", () => {
  it("saves a valid report with the visitor's address", async () => {
    db.parseListingId.mockReturnValue(7);
    expect(await reportListingAction({}, form({ listingId: "7", reason: "fake", note: "" }))).toEqual({ sent: true });
    expect(db.reportListing).toHaveBeenCalledWith(7, { reason: "fake", note: undefined }, "1.2.3.4");
  });

  it("refuses a bad listing or reason", async () => {
    db.parseListingId.mockReturnValue(null);
    expect(await reportListingAction({}, form({ listingId: "x", reason: "fake" }))).toEqual({ invalid: true });
    db.parseListingId.mockReturnValue(7);
    expect(await reportListingAction({}, form({ listingId: "7", reason: "castle" }))).toEqual({ invalid: true });
    expect(db.reportListing).not.toHaveBeenCalled();
  });
});
