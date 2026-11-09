import { describe, expect, it } from "vitest";
import { parseLead, parseListingDraft, parsePhone } from "./index";

describe("parsePhone", () => {
  it.each(["555123456", "555 12 34 56", "+995555123456", "+995 (555) 12-34-56", "00995555123456", "995555123456"])(
    "normalizes %s",
    (input) => {
      expect(parsePhone(input)).toBe("+995555123456");
    },
  );

  it.each(["", "abc", "55512345", "5551234567", "455123456", "+1555123456", "+971501234567"])("rejects %j", (input) => {
    expect(parsePhone(input)).toBeNull();
  });
});

describe("parseLead", () => {
  it("normalizes a valid request", () => {
    expect(parseLead({ name: " Nino ", phone: "555 12 34 56", deal: "rent", extra: "x" })).toEqual({
      name: "Nino",
      phone: "+995555123456",
      deal: "rent",
    });
  });

  it.each([
    ["no name", { name: " " }],
    ["bad phone", { phone: "123" }],
    ["daily deal", { deal: "daily" }],
    ["NUL in name", { name: "a\0b" }],
  ])("rejects %s", (_name, change) => {
    expect(parseLead({ name: "Nino", phone: "555123456", deal: "sale", ...change })).toBeNull();
  });
});

describe("parseListingDraft", () => {
  const valid = {
    deal: "sale",
    type: "apartment",
    city: "batumi",
    district: " Old town ",
    address: "Main 1",
    title: "Flat",
    description: "Sunny",
    price: "148000",
    currency: "USD",
    area: "92.5",
    rooms: "3",
    floor: "7",
    floors: "12",
  };

  it("converts a valid form and trims text", () => {
    expect(parseListingDraft(valid)).toEqual({
      ...valid,
      district: "Old town",
      price: 148000,
      area: 92.5,
      rooms: 3,
      floor: 7,
      floors: 12,
    });
  });

  it("never carries owner, status or verification from the form", () => {
    expect(parseListingDraft({ ...valid, ownerId: "x", status: "ACTIVE", verified: "true", agentId: "a" })).not.toEqual(
      expect.objectContaining({ ownerId: "x" }),
    );
    const draft = parseListingDraft({ ...valid, status: "ACTIVE", verified: "true" });
    expect(draft).not.toHaveProperty("status");
    expect(draft).not.toHaveProperty("verified");
  });

  it("allows land and commercial property without rooms", () => {
    expect(parseListingDraft({ ...valid, type: "land", rooms: "", floor: "", floors: "" })?.rooms).toBeUndefined();
    expect(parseListingDraft({ ...valid, type: "commercial", rooms: "" })?.rooms).toBeUndefined();
  });

  it.each(["apartment", "house"])("requires rooms for a %s", (type) => {
    expect(parseListingDraft({ ...valid, type, rooms: "" })).toBeNull();
  });

  it("reads an optional map pin", () => {
    expect(parseListingDraft({ ...valid, lat: "41.709512", lng: "-44.76" })).toMatchObject({ lat: 41.709512, lng: -44.76 });
    expect(parseListingDraft({ ...valid, lat: "", lng: "" })?.lat).toBeUndefined();
  });

  it("accepts a missing floor pair", () => {
    const { floor: _floor, floors: _floors, ...rest } = valid;
    expect(parseListingDraft(rest)?.floor).toBeUndefined();
  });

  it.each([
    ["latitude without longitude", { lat: "41.7" }],
    ["longitude without latitude", { lng: "44.7" }],
    ["latitude out of range", { lat: "91", lng: "44.7" }],
    ["longitude out of range", { lat: "41.7", lng: "181" }],
    ["text coordinate", { lat: "north", lng: "44.7" }],
    ["floor without total", { floors: "" }],
    ["total without floor", { floor: "" }],
    ["floor above total", { floor: "13" }],
    ["blank title", { title: "   " }],
    ["long title", { title: "x".repeat(121) }],
    ["NUL byte in text", { title: "a\0b" }],
    ["unknown deal", { deal: "barter" }],
    ["unknown city", { city: "kutaisi" }],
    ["unknown currency", { currency: "EUR" }],
    ["zero price", { price: "0" }],
    ["price over the column limit", { price: "2000000001" }],
    ["text price", { price: "abc" }],
    ["zero area", { area: "0" }],
    ["negative area", { area: "-5" }],
    ["too many rooms", { rooms: "51" }],
  ])("rejects %s", (_name, change) => {
    expect(parseListingDraft({ ...valid, ...change })).toBeNull();
  });
});
