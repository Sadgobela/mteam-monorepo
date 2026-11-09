import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { countListings, createListing, getListing, searchListings } from "./index";

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
  condition: "New",
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
      condition: "New",
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
      condition: undefined,
      agent: undefined,
      contactPhone: "+995owner",
      tone: "sand",
    });
  });

  it("maps building status and metro", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, building: "CONSTRUCTION", metro: "დელისი", street: "ატენის ქ." });
    expect(await getListing("20418")).toMatchObject({ building: "construction", metro: "დელისი", street: "ატენის ქ." });
  });

  it("copes with a broker who has no name or branch", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      agent: { id: "a2", user: { name: null, phone: "+995", role: "AGENT" }, branch: null },
    });
    expect((await getListing("20418"))?.agent).toEqual({ id: "a2", name: "", branch: "", phone: "+995" });
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
    expect(JSON.parse(JSON.stringify(where))).toEqual({ status: "ACTIVE", priceUsd: {}, area: {}, floor: {}, pricePerSqmUsd: {} });
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
    expect((await whereFor({ rooms: 4 })).rooms).toEqual({ gte: 4 });
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
