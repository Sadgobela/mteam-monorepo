import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), groupBy: vi.fn(), fields: { floors: "FLOORS" } },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { countSellerListings, listSellerListings, listSimilarListings, countListings, createListing, getListing, searchListings, sitemapListings, sitemapSearches } from "./index";

const fullRow = {
  id: 20418,
  status: "ACTIVE",
  deal: "SALE",
  type: "APARTMENT",
  title: "Flat",
  description: "Sunny",
  city: "Tbilisi",
  district: "Vake",
  address: "Main 1",
  price: 148000,
  currency: "USD",
  area: 92,
  rooms: 3,
  floor: 7,
  floors: 12,
  lat: 41.7,
  lng: 44.7,
  condition: "new_renovated",
  features: ["lift"],
  bedrooms: 2,
  ceiling: 3,
  yearBuilt: 2019,
  verified: true,
  agent: { id: "a1", user: { name: "Nino", phone: "+995", role: "AGENT" }, branch: { name: "Vake" } },
  images: [{ url: "https://cdn/a.jpg" }, { url: "https://cdn/b.jpg" }],
  owner: { phone: "+995owner" },
  updatedAt: new Date("2026-11-06T10:00:00Z"),
};

const bareRow = {
  ...fullRow,
  id: 20421,
  deal: "DAILY",
  type: "LAND",
  district: null,
  address: null,
  rooms: null,
  floor: null,
  floors: null,
  lat: null,
  lng: null,
  condition: null,
  features: [],
  bedrooms: null,
  ceiling: null,
  yearBuilt: null,
  verified: false,
  agent: null,
};

beforeEach(() => vi.resetAllMocks());

describe("getListing", () => {
  it("maps a full row to the shared shape", async () => {
    prisma.listing.findFirst.mockResolvedValue(fullRow);
    expect(await getListing("20418")).toEqual({
      id: 20418,
      deal: "sale",
      type: "apartment",
      title: "Flat",
      description: "Sunny",
      city: "Tbilisi",
      district: "Vake",
      address: "Main 1",
      price: 148000,
      currency: "USD",
      area: 92,
      rooms: 3,
      floor: 7,
      floors: 12,
      lat: 41.7,
      lng: 44.7,
      specs: { condition: "new_renovated" },
      features: ["lift"],
      bedrooms: 2,
      ceiling: 3,
      yearBuilt: 2019,
      verified: true,
      agent: { id: "a1", name: "Nino", branch: "Vake", phone: "+995" },
      contactPhone: "+995",
      images: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
      tone: "steel",
      updatedAt: "2026-11-06",
    });
  });

  it("fills required fields and drops optional ones when the row has nulls", async () => {
    prisma.listing.findFirst.mockResolvedValue(bareRow);
    expect(await getListing("20421")).toMatchObject({
      deal: "daily",
      type: "land",
      district: "",
      address: "",
      rooms: 0,
      floor: undefined,
      floors: undefined,
      specs: {},
      bedrooms: undefined,
      ceiling: undefined,
      yearBuilt: undefined,
      agent: undefined,
      contactPhone: "+995owner",
      tone: "sand",
    });
  });

  it("maps building status and metro", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, building: "CONSTRUCTION", metro: "დელისი", street: "ატენის ქ." });
    expect(await getListing("20418")).toMatchObject({ building: "construction", metro: "დელისი", street: "ატენის ქ." });
  });

  it("carries the market level when there is one", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, marketLevel: 4 });
    expect((await getListing("20418"))?.marketLevel).toBe(4);
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, marketLevel: null });
    expect((await getListing("20418"))?.marketLevel).toBeUndefined();
  });

  it("ignores a stored detail that is no longer a known choice", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, condition: "retired_value" });
    expect((await getListing("20418"))?.specs).toEqual({});
  });

  it("copes with a broker who has no name or branch", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      agent: { id: "a2", user: { name: null, phone: "+995", role: "AGENT" }, branch: null },
    });
    expect((await getListing("20418"))?.agent).toEqual({ id: "a2", name: "", branch: "", phone: "+995" });
  });

  it("copes with people without a phone", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      agent: { id: "a2", user: { name: "Nino", phone: null, role: "AGENT" }, branch: null },
      owner: { phone: null },
    });
    const listing = await getListing("20418");
    expect(listing?.agent?.phone).toBe("");
    expect(listing?.contactPhone).toBe("");
  });

  it("does not publish the phone of someone who is no longer a broker", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      agent: { id: "a3", user: { name: "Ex", phone: "+995private", role: "USER" }, branch: null },
    });
    const listing = await getListing("20418");
    expect(listing?.agent).toBeUndefined();
    expect(listing?.contactPhone).toBe("+995owner");
  });

  it("only looks up published listings and selects no more than the owner's phone", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    expect(await getListing("20418")).toBeUndefined();
    const args = prisma.listing.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: 20418, status: "ACTIVE" });
    expect(args.include.owner).toEqual({ select: { phone: true } });
    expect(args.include.agent.include.user).toEqual({ select: { name: true, phone: true, role: true } });
  });

  it.each(["abc", "", "0", "-1", "1e3", " 12", "1.5", "0012", "2147483648", "99999999999"])(
    "treats %j as not found without querying",
    async (raw) => {
      expect(await getListing(raw)).toBeUndefined();
      expect(prisma.listing.findFirst).not.toHaveBeenCalled();
    },
  );

  it("accepts the largest id the column can hold", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    await getListing("2147483647");
    expect(prisma.listing.findFirst.mock.calls[0][0].where.id).toBe(2147483647);
  });
});

describe("sitemap queries", () => {
  it("lists only published listings, within what one sitemap file holds", async () => {
    prisma.listing.findMany.mockResolvedValue([{ id: 7, updatedAt: new Date("2026-11-01") }]);
    expect(await sitemapListings()).toHaveLength(1);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "ACTIVE" }, take: 45_000 });
  });

  it("gives each combination with something to show, in the site's own words", async () => {
    prisma.listing.groupBy.mockResolvedValue([{ deal: "SALE", type: "COUNTRY_HOUSE", city: "Batumi" }]);
    expect(await sitemapSearches()).toEqual([{ deal: "sale", type: "country", city: "Batumi" }]);
    expect(prisma.listing.groupBy.mock.calls[0][0].where).toEqual({ status: "ACTIVE" });
  });
});

describe("searchListings", () => {
  const whereFor = async (filters: Parameters<typeof searchListings>[0]) => {
    prisma.listing.findMany.mockResolvedValue([]);
    await searchListings(filters);
    return prisma.listing.findMany.mock.calls[0][0].where;
  };

  it("returns a bounded page of published listings, verified first", async () => {
    prisma.listing.findMany.mockResolvedValue([fullRow, bareRow]);
    expect((await searchListings()).map((l) => l.id)).toEqual([20418, 20421]);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: "ACTIVE" },
      orderBy: [{ verified: "desc" }, { id: "desc" }],
      skip: 0,
      take: 24,
    });
  });

  it("applies no filter beyond published when none is given", async () => {
    const where = await whereFor({});
    expect(JSON.parse(JSON.stringify(where))).toEqual({ status: "ACTIVE", priceUsd: {}, area: {}, floor: {}, floors: {}, ceiling: {}, pricePerSqmUsd: {} });
  });

  it.each([
    ["asc", [{ priceUsd: "asc" }, { id: "desc" }]],
    ["desc", [{ priceUsd: "desc" }, { id: "desc" }]],
  ] as const)("sorts by normalized price %s", async (sort, orderBy) => {
    prisma.listing.findMany.mockResolvedValue([]);
    await searchListings({}, { sort });
    expect(prisma.listing.findMany.mock.calls[0][0].orderBy).toEqual(orderBy);
  });

  it("pages through results and honours a custom limit", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    await searchListings({}, { page: 3 });
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ skip: 48, take: 24 });
    await searchListings({}, { limit: 4 });
    expect(prisma.listing.findMany.mock.calls[1][0]).toMatchObject({ skip: 0, take: 4 });
  });

  it("filters on area and floor ranges", async () => {
    const where = await whereFor({ areaMin: 40, areaMax: 90, floorMin: 3, floorMax: 9 });
    expect(where.area).toEqual({ gte: 40, lte: 90 });
    expect(where.floor).toEqual({ gte: 3, lte: 9 });
  });

  it("limits to listings with a location only when asked", async () => {
    expect((await whereFor({})).lat).toBeUndefined();
    prisma.listing.findMany.mockClear();
    prisma.listing.findMany.mockResolvedValue([]);
    await searchListings({}, { located: true });
    const where = prisma.listing.findMany.mock.calls[0][0].where;
    expect(where.lat).toEqual({ not: null });
    expect(where.lng).toEqual({ not: null });
  });

  it("filters to verified listings", async () => {
    expect((await whereFor({ verified: true })).verified).toBe(true);
  });

  it("filters by exact districts when they are given", async () => {
    expect((await whereFor({ city: "თბილისი", district: ["ვაკე", "ვერა"] })).district).toEqual({ in: ["ვაკე", "ვერა"] });
  });

  it("does not filter by district or street otherwise", async () => {
    const where = await whereFor({});
    expect(where.district).toBeUndefined();
    expect(where.street).toBeUndefined();
  });

  it("filters by metro, building status, owners and price per m²", async () => {
    expect(await whereFor({ metro: "დელისი", building: ["old", "construction"], owner: true, sqmMin: 500, sqmMax: 900 })).toMatchObject({
      metro: "დელისი",
      building: { in: ["OLD", "CONSTRUCTION"] },
      agentId: null,
      pricePerSqmUsd: { gte: 500, lte: 900 },
    });
  });

  it("finds listings below the market", async () => {
    expect(await whereFor({ belowMarket: true })).toMatchObject({ marketLevel: { lte: 2 } });
    prisma.listing.findMany.mockClear();
    expect((await whereFor({})).marketLevel).toBeUndefined();
  });

  it("filters by details and features", async () => {
    expect(await whereFor({ heating: ["central", "gas"], features: ["lift", "sauna"], bedrooms: 2, floorsMax: 9, ceilingMin: 2.5 })).toMatchObject({
      heating: { in: ["central", "gas"] },
      features: { hasEvery: ["lift", "sauna"] },
      bedrooms: 2,
      floors: { lte: 9 },
      ceiling: { gte: 2.5 },
    });
  });

  it("treats the top bedroom count as a minimum", async () => {
    expect((await whereFor({ bedrooms: 10 })).bedrooms).toEqual({ gte: 10 });
  });

  it.each([
    ["last", { equals: "FLOORS" }],
    ["notLast", { not: { equals: "FLOORS" } }],
    ["notFirst", { gte: 2 }],
  ] as const)("compares the floor with the building for %s", async (floorPos, expected) => {
    expect(await whereFor({ floorPos })).toMatchObject({ floor: expected });
  });

  it("keeps a higher minimum floor when asked for not first", async () => {
    expect((await whereFor({ floorPos: "notFirst", floorMin: 5 })).floor.gte).toBe(5);
  });

  it("finds a listing by its number as well as by text", async () => {
    expect((await whereFor({ q: "20418" })).OR).toContainEqual({ id: 20418 });
  });

  it("does not treat text as a listing number", async () => {
    expect((await whereFor({ q: "vake" })).OR).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });

  it("filters by exact streets when they are given", async () => {
    expect((await whereFor({ city: "თბილისი", street: ["ატენის ქ."] })).street).toEqual({ in: ["ატენის ქ."] });
  });

  it("matches text across location and title, case-insensitively", async () => {
    const match = { contains: "vake", mode: "insensitive" };
    expect((await whereFor({ q: "vake" })).OR).toEqual([{ district: match }, { address: match }, { street: match }, { city: match }, { title: match }]);
  });

  it("translates deal, type and city to stored values and stays published-only", async () => {
    expect(await whereFor({ deal: "rent", type: "house", city: "ბათუმი" })).toMatchObject({
      status: "ACTIVE",
      deal: "RENT",
      type: "HOUSE",
      city: "ბათუმი",
    });
  });

  it.each([1, 3])("matches exactly %i rooms", async (rooms) => {
    expect((await whereFor({ rooms })).rooms).toBe(rooms);
  });

  it("treats the top room option as that many or more", async () => {
    expect((await whereFor({ rooms: 10 })).rooms).toEqual({ gte: 10 });
  });

  it("treats LIKE wildcards in the text as plain characters", async () => {
    expect((await whereFor({ q: "50%_a\\" })).OR[0].district.contains).toBe("50\\%\\_a\\\\");
  });

  it("filters on the normalized USD price, one-sided or both", async () => {
    expect((await whereFor({ priceMin: 1000, priceMax: 2000 })).priceUsd).toEqual({ gte: 1000, lte: 2000 });
    prisma.listing.findMany.mockClear();
    expect((await whereFor({ priceMin: 0 })).priceUsd).toEqual({ gte: 0, lte: undefined });
  });
});

describe("verification details", () => {
  it("names who checked a listing and when", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      verifiedAt: new Date("2026-11-05T09:00:00Z"),
      verifiedBy: { user: { name: "Nino" } },
    });
    expect((await getListing("20418"))?.verification).toEqual({ by: "Nino", at: "2026-11-05" });
  });

  it("falls back to MTeam when the broker has no name", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, verifiedAt: new Date("2026-11-05T09:00:00Z"), verifiedBy: null });
    expect((await getListing("20418"))?.verification?.by).toBe("MTeam");
  });
});

describe("createListing", () => {
  const draft = {
    deal: "rent",
    type: "house",
    city: "ბათუმი",
    district: "Old town",
    address: "Main 1",
    title: "House",
    description: "Sunny",
    price: 900,
    currency: "GEL",
    area: 80,
    rooms: 4,
  } as const;

  it("stores a pending, unverified listing owned by the user, with photos in order", async () => {
    prisma.listing.create.mockResolvedValue({ id: 7 });
    expect(await createListing("u1", draft, ["https://cdn/a.jpg", "https://cdn/b.jpg"])).toBe(7);
    expect(prisma.listing.create.mock.calls[0][0].data).toEqual({
      ...draft,
      priceUsd: 333,
      pricePerSqmUsd: 4,
      building: undefined,
      deal: "RENT",
      type: "HOUSE",
      city: "ბათუმი",
      status: "PENDING",
      verified: false,
      ownerId: "u1",
      images: {
        create: [
          { url: "https://cdn/a.jpg", position: 0 },
          { url: "https://cdn/b.jpg", position: 1 },
        ],
      },
    });
  });
});

describe("createListing building status", () => {
  it("stores the status in the database's form", async () => {
    prisma.listing.create.mockResolvedValue({ id: 8 });
    await createListing("u1", { deal: "sale", type: "house", city: "ბათუმი", address: "a", title: "t", description: "d", price: 100, currency: "USD", area: 10, building: "new" }, []);
    expect(prisma.listing.create.mock.calls[0][0].data).toMatchObject({ building: "NEW", pricePerSqmUsd: 10 });
  });
});

describe("similar and seller listings", () => {
  const listing = { id: 5, deal: "sale", type: "apartment", city: "თბილისი", price: 100000, currency: "USD", rooms: 3 } as Parameters<typeof listSimilarListings>[0];

  it("finds the same kind of place at a nearby price and size, excluding itself", async () => {
    prisma.listing.findMany.mockResolvedValue([fullRow]);
    expect(await listSimilarListings(listing)).toHaveLength(1);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: "ACTIVE", id: { not: 5 }, deal: "SALE", type: "APARTMENT", city: "თბილისი", priceUsd: { gte: 70000, lte: 130000 }, rooms: { gte: 2, lte: 4 } },
      take: 4,
    });
  });

  it("leaves out hidden listings", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    await listSimilarListings(listing, [9]);
    expect(prisma.listing.findMany.mock.calls[0][0].where.id).toEqual({ not: 5, notIn: [9] });
  });

  it("finds nothing for a malformed seller id without querying", async () => {
    expect(await listSellerListings("bad id")).toEqual([]);
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("does not compare rooms for property without them", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    await listSimilarListings({ ...listing, rooms: 0 });
    expect(prisma.listing.findMany.mock.calls[0][0].where.rooms).toBeUndefined();
  });

  it("lists and counts only an owner's own published listings", async () => {
    prisma.listing.findMany.mockResolvedValue([fullRow]);
    prisma.listing.count.mockResolvedValue(2);
    expect(await listSellerListings("u1")).toHaveLength(1);
    expect(await countSellerListings("u1")).toBe(2);
    const where = { status: "ACTIVE", ownerId: "u1", agentId: null, owner: { role: "USER" } };
    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual(where);
    expect(prisma.listing.count.mock.calls[0][0].where).toEqual(where);
  });

  it("leaves out listings the user has hidden", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    await searchListings({}, { hiddenIds: [7] });
    await countListings({}, { hiddenIds: [7] });
    expect(prisma.listing.findMany.mock.calls[0][0].where.id).toEqual({ notIn: [7] });
    expect(prisma.listing.count.mock.calls[0][0].where.id).toEqual({ notIn: [7] });
  });
});

describe("countListings", () => {
  it("counts with the same filters as the search", async () => {
    prisma.listing.count.mockResolvedValue(3);
    expect(await countListings({ deal: "sale", verified: true })).toBe(3);
    expect(prisma.listing.count.mock.calls[0][0].where).toMatchObject({ status: "ACTIVE", deal: "SALE", verified: true });
  });

  it("uses exactly the search's conditions", async () => {
    const filters = { deal: "sale", q: "vake", priceMin: 100, priceMax: 200, rooms: 4, verified: true } as const;
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    await searchListings(filters);
    await countListings(filters);
    expect(prisma.listing.count.mock.calls[0][0].where).toEqual(prisma.listing.findMany.mock.calls[0][0].where);
  });

  it("can count only located listings", async () => {
    prisma.listing.count.mockResolvedValue(1);
    await countListings({}, { located: true });
    expect(prisma.listing.count.mock.calls[0][0].where).toMatchObject({ lat: { not: null }, lng: { not: null } });
  });

  it("counts everything published by default", async () => {
    prisma.listing.count.mockResolvedValue(9);
    expect(await countListings()).toBe(9);
    expect(prisma.listing.count.mock.calls[0][0].where).toMatchObject({ status: "ACTIVE" });
  });
});
