import type { PrismaClient } from "@prisma/client";
import { streetsIn } from "@mteam/shared/streets";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importListings, parseCsv } from "./import";

const client = {
  user: { findUnique: vi.fn() },
  agent: { findMany: vi.fn() },
  listing: { findMany: vi.fn(), create: vi.fn() },
};
const prisma = client as unknown as PrismaClient;

const OWNER = "555000001";
const HEADER = "ref,deal,type,city,district,address,street,title,description,price,currency,area,rooms,agentPhone,photos";
const row = (over: Partial<Record<string, string>> = {}) => {
  const cells = { ref: "A1", deal: "sale", type: "apartment", city: "თბილისი", district: "ვაკე", address: "Example 1", street: "", title: "Flat", description: "Nice", price: "100000", currency: "USD", area: "50", rooms: "2", agentPhone: "", photos: "", ...over };
  return Object.values(cells).join(",");
};
const run = (...rows: string[]) => importListings(prisma, [HEADER, ...rows].join("\n"), { ownerPhone: OWNER });
const created = () => client.listing.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  client.user.findUnique.mockResolvedValue({ id: "owner" });
  client.agent.findMany.mockResolvedValue([{ id: "agent", user: { phone: "+995555000002" } }]);
  client.listing.findMany.mockResolvedValue([]);
  client.listing.create.mockResolvedValue({ id: 1 });
});

describe("parseCsv", () => {
  it("reads quotes, doubled quotes, separators and line breaks inside cells", () => {
    expect(parseCsv('a,"b,c"\r\n"d ""e""","f\ng"\n')).toEqual([["a", "b,c"], ['d "e"', "f\ng"]]);
  });

  it("drops Excel's byte order mark and reads its semicolons", () => {
    expect(parseCsv("﻿a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps commas when the header uses them, and a last empty cell", () => {
    expect(parseCsv("a,b;c\n1,")).toEqual([["a", "b;c"], ["1", ""]]);
  });

  it("finds nothing in an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("importListings", () => {
  it("adds a valid row as pending, unverified and remembered by its ref", async () => {
    expect(await run(row())).toEqual({ created: 1, skipped: 0, problems: [] });
    expect(created()).toMatchObject({ status: "PENDING", verified: false, sourceRef: "A1", ownerId: "owner", agentId: null, deal: "SALE", type: "APARTMENT", priceUsd: 100000, pricePerSqmUsd: 2000, images: { create: [] } });
  });

  it("publishes only when told to", async () => {
    await importListings(prisma, [HEADER, row()].join("\n"), { ownerPhone: OWNER, publish: true });
    expect(created().status).toBe("ACTIVE");
  });

  it("links the broker and the photos in order", async () => {
    await run(row({ agentPhone: "555 000 002", photos: "https://x.test/1.jpg|https://x.test/2.jpg" }));
    expect(created()).toMatchObject({ agentId: "agent", images: { create: [{ url: "https://x.test/1.jpg", position: 0 }, { url: "https://x.test/2.jpg", position: 1 }] } });
  });

  it("only looks up people who are brokers", async () => {
    await run(row());
    expect(client.agent.findMany.mock.calls[0][0].where).toEqual({ user: { role: "AGENT" } });
  });

  it("accepts a street on the list", async () => {
    const [street] = streetsIn("თბილისი", ["ვაკე"]);
    expect((await run(row({ street }))).created).toBe(1);
  });

  it("skips what was imported before and repeats within the file", async () => {
    client.listing.findMany.mockResolvedValue([{ sourceRef: "OLD" }]);
    expect(await run(row({ ref: "OLD" }), row({ ref: "NEW" }), row({ ref: "NEW" }))).toEqual({ created: 1, skipped: 2, problems: [] });
  });

  it("ignores empty rows and keeps going past bad ones, naming each by its Excel row", async () => {
    const result = await run(
      row({ price: "free" }),
      ",,,,,,,,,,,,,,",
      "too,short",
      row({ ref: "" }),
      row({ ref: "A2", street: "Not a real street" }),
      row({ ref: "A3", city: "თბილისი", district: "" }),
      row({ ref: "A4", agentPhone: "555000009" }),
      row({ ref: "A5", agentPhone: "nonsense" }),
      row({ ref: "A6", photos: "javascript:alert(1)" }),
      row({ ref: "A7", photos: Array(11).fill("https://x.test/a.jpg").join("|") }),
      row({ ref: "A8" }),
    );
    expect(result).toEqual({
      created: 1,
      skipped: 0,
      problems: [
        { row: 2, reason: "price" },
        { row: 4, reason: "number of columns" },
        { row: 5, reason: "ref" },
        { row: 6, reason: "street" },
        { row: 7, reason: "combination" },
        { row: 8, reason: "agentPhone" },
        { row: 9, reason: "agentPhone" },
        { row: 10, reason: "photos" },
        { row: 11, reason: "photos" },
      ],
    });
  });

  it("checks a street against the whole city when a row has no district", async () => {
    const result = await importListings(prisma, ["ref,deal,type,city,address,street,title,description,price,currency,area,rooms", "A1,sale,apartment,ბორჯომი,Example 1,Nope,Flat,Nice,100000,USD,50,2"].join("\n"), { ownerPhone: OWNER });
    expect(result.problems).toHaveLength(1);
  });

  it("refuses a file with columns it does not know, before touching anything", async () => {
    await expect(importListings(prisma, "ref,prce\n1,2", { ownerPhone: OWNER })).rejects.toThrow("prce");
    expect(client.user.findUnique).not.toHaveBeenCalled();
  });

  it("needs a ref column, even in an empty file", async () => {
    await expect(importListings(prisma, "deal\nsale", { ownerPhone: OWNER })).rejects.toThrow("ref");
    await expect(importListings(prisma, "", { ownerPhone: OWNER })).rejects.toThrow("ref");
  });

  it("needs an owner who exists", async () => {
    client.user.findUnique.mockResolvedValue(null);
    await expect(run(row())).rejects.toThrow("phone");
    await expect(importListings(prisma, HEADER, { ownerPhone: "nonsense" })).rejects.toThrow("phone");
    expect(client.user.findUnique.mock.calls[1][0].where.phone).toBe("");
  });
});
