import { describe, expect, it } from "vitest";
import type { Listing } from "@mteam/shared";
import { queryRecord, toPublicListing } from "./public-listing";

const listing = { id: 1, title: "Flat", contactPhone: "+995555000000", sellerId: "u1" } as Listing;

describe("toPublicListing", () => {
  it("leaves out the contact number", () => {
    expect(toPublicListing(listing)).toEqual({ id: 1, title: "Flat", sellerId: "u1" });
  });

  it("keeps the broker but not the broker's number", () => {
    const withAgent = { ...listing, agent: { id: "a1", name: "Nino", branch: "Vake", phone: "+995555111111" } };
    expect(toPublicListing(withAgent)).toEqual({ id: 1, title: "Flat", sellerId: "u1", agent: { id: "a1", name: "Nino", branch: "Vake" } });
  });
});

describe("queryRecord", () => {
  it("keeps a single value as text and a repeated one as a list", () => {
    expect(queryRecord(new URLSearchParams("deal=sale&district=a&district=b"))).toEqual({ deal: "sale", district: ["a", "b"] });
  });
});
