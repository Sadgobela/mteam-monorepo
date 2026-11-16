import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn(), fields: { floors: "FLOORS" } },
  listingImage: { deleteMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
  listingPriceChange: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  // No stored rate, so the fallback of 2.7 lari per dollar applies.
  exchangeRate: { findUnique: vi.fn(async () => null) },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { draftFields, type ListingDraft } from "@mteam/shared";
import {
  countSellerListings,
  listSellerListings,
  listSimilarListings,
  countListings,
  createListing,
  getEditableListing,
  getListing,
  hidesPhoneByDefault,
  photosOfOthers,
  saveDraft,
  searchListings,
  sitemapListings,
  sitemapSearches,
  updateListing,
} from "./index";

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

  it("says when the number is hidden, and never gives out the cadastral code", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ...fullRow, hidePhone: true, cadastralCode: "01.10.14" });
    const listing = await getListing("20418");
    expect(listing?.hidePhone).toBe(true);
    expect(JSON.stringify(listing)).not.toContain("01.10.14");
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
  // The conditions are the same for every sort; a price sort reads them in a single query.
  const whereFor = async (filters: Parameters<typeof searchListings>[0]) => {
    prisma.listing.findMany.mockResolvedValue([]);
    await searchListings(filters, { sort: "asc" });
    return prisma.listing.findMany.mock.calls[0][0].where;
  };

  describe("newest first", () => {
    const at = (day: number) => new Date(Date.UTC(2026, 10, day));
    const listing = (id: number, verified: boolean, createdAt: Date, bumpedAt: Date | null = null) => ({ ...bareRow, id, verified, createdAt, bumpedAt });

    it("puts verified first, then orders by the last bump, else creation", async () => {
      prisma.listing.findMany
        .mockResolvedValueOnce([listing(1, true, at(1), at(9)), listing(2, false, at(2), at(8))])
        .mockResolvedValueOnce([listing(3, true, at(5)), listing(4, false, at(10)), listing(5, false, at(5)), listing(6, false, at(5))]);
      // 2 was bumped on the 8th: after 4, created on the 10th, and before 5 and 6, created on the 5th, which tie and go by id.
      expect((await searchListings()).map((l) => l.id)).toEqual([1, 3, 4, 2, 6, 5]);
      const [bumped, unbumped] = prisma.listing.findMany.mock.calls.map(([query]) => query);
      expect(bumped).toMatchObject({ where: { status: "ACTIVE", bumpedAt: { not: null } }, orderBy: [{ verified: "desc" }, { bumpedAt: "desc" }, { id: "desc" }], take: 24 });
      expect(unbumped).toMatchObject({ where: { status: "ACTIVE", bumpedAt: null }, orderBy: [{ verified: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 24 });
    });

    it("reads enough of both halves to cut out a later page", async () => {
      prisma.listing.findMany
        .mockResolvedValueOnce([listing(1, false, at(1), at(9)), listing(2, false, at(1), at(7))])
        .mockResolvedValueOnce([listing(3, false, at(8)), listing(4, false, at(6))]);
      expect((await searchListings({}, { page: 2, limit: 2 })).map((l) => l.id)).toEqual([2, 4]);
      expect(prisma.listing.findMany.mock.calls.map(([query]) => query.take)).toEqual([4, 4]);
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
    await searchListings({}, { page: 3, sort: "asc" });
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ skip: 48, take: 24 });
    await searchListings({}, { limit: 4, sort: "asc" });
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
    hidePhone: false,
  } as const;

  it("stores a pending, unverified listing owned by the user, with photos in order", async () => {
    prisma.listing.create.mockResolvedValue({ id: 7 });
    expect(await createListing("u1", draft, ["https://cdn/a.jpg", "https://cdn/b.jpg"])).toBe(7);
    expect(prisma.listing.create.mock.calls[0][0].data).toEqual({
      ...Object.fromEntries(draftFields.map((name) => [name, null])),
      ...draft,
      features: [],
      priceUsd: 333,
      pricePerSqmUsd: 4,
      building: null,
      deal: "RENT",
      type: "HOUSE",
      city: "ბათუმი",
      status: "PENDING",
      verified: false,
      ownerId: "u1",
      agentId: null,
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
    await createListing("u1", { deal: "sale", type: "house", city: "ბათუმი", address: "a", title: "t", description: "d", price: 100, currency: "USD", area: 10, building: "new", hidePhone: true }, []);
    expect(prisma.listing.create.mock.calls[0][0].data).toMatchObject({ building: "NEW", pricePerSqmUsd: 10, hidePhone: true });
  });

  it("gives a broker's listing to the broker, so it never expires", async () => {
    prisma.listing.create.mockResolvedValue({ id: 8 });
    await createListing("u1", { deal: "sale", type: "land", city: "ბათუმი", address: "a", title: "t", description: "d", price: 100, currency: "USD", area: 10, hidePhone: false }, [], "a1");
    expect(prisma.listing.create.mock.calls[0][0].data.agentId).toBe("a1");
  });
});

describe("editing", () => {
  const draft: ListingDraft = {
    deal: "sale",
    type: "apartment",
    city: "თბილისი",
    district: "ვაკე",
    address: "Main 1",
    title: "Flat",
    description: "Sunny",
    price: 100000,
    currency: "USD",
    area: 50,
    rooms: 2,
    features: ["lift", "balcony"],
    hidePhone: false,
  };
  const photos = ["https://cdn/a.jpg", "https://cdn/b.jpg"];
  // The row as the database holds the draft above.
  const stored = {
    ...Object.fromEntries(draftFields.map((name) => [name, null])),
    ...draft,
    id: 9,
    deal: "SALE",
    type: "APARTMENT",
    features: ["balcony", "lift"],
    priceUsd: 100000,
    pricePerSqmUsd: 2000,
    images: photos.map((url) => ({ url })),
  };

  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => unknown) => work(prisma));
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });
  });

  describe("updateListing", () => {
    const edit = (status: string, change: Record<string, unknown> = {}, images = photos) => {
      prisma.listing.findFirst.mockResolvedValue({ ...stored, status });
      return updateListing("u1", 9, { ...draft, ...change }, images);
    };

    it("keeps a published listing live when only the price changed, and records the old and new dollar price", async () => {
      expect(await edit("ACTIVE", { price: 90000 })).toBe("ACTIVE");
      expect(prisma.listing.updateMany).toHaveBeenCalledWith({ where: { id: 9, ownerId: "u1", status: "ACTIVE" }, data: expect.objectContaining({ price: 90000, priceUsd: 90000, status: "ACTIVE" }) });
      expect(prisma.listing.updateMany.mock.calls[0][0].data).not.toHaveProperty("expiresAt");
      // The verification vouched for photos, area and price, and a new price alone keeps the badge.
      expect(prisma.listing.updateMany.mock.calls[0][0].data).not.toHaveProperty("verified");
      expect(prisma.listingPriceChange.create).toHaveBeenCalledWith({ data: { listingId: 9, oldPriceUsd: 100000, newPriceUsd: 90000 } });
    });

    it("records a change of currency as a price change", async () => {
      expect(await edit("ACTIVE", { price: 100000, currency: "GEL" })).toBe("ACTIVE");
      expect(prisma.listingPriceChange.create).toHaveBeenCalledWith({ data: { listingId: 9, oldPriceUsd: 100000, newPriceUsd: 37037 } });
    });

    it("keeps a published listing live and records nothing when nothing changed, the order of features aside", async () => {
      expect(await edit("ACTIVE")).toBe("ACTIVE");
      expect(prisma.listingPriceChange.create).not.toHaveBeenCalled();
    });

    // Every field but the price, so a field added later cannot slip past moderation.
    it.each(draftFields.filter((name) => name !== "price" && name !== "currency"))("sends a published listing back to review when %s changes", async (name) => {
      const changes: Record<string, unknown> = { deal: "rent", type: "house", city: "ბათუმი", features: ["lift"], hidePhone: true, area: 51, building: "new", lat: 41.7, lng: 44.7 };
      expect(await edit("ACTIVE", { [name]: changes[name] ?? 7 })).toBe("PENDING");
      // Without an end date, so renewing it cannot bring the change back unreviewed.
      expect(prisma.listing.updateMany.mock.calls[0][0].data).toMatchObject({ status: "PENDING", expiresAt: null, verified: false, verifiedAt: null, verifiedById: null });
    });

    it.each([
      ["a removed photo", ["https://cdn/a.jpg"]],
      ["an added photo", [...photos, "https://cdn/c.jpg"]],
      ["photos in a new order", [...photos].reverse()],
    ])("sends a published listing back to review for %s, and stores the photos in the order given", async (_name, images) => {
      expect(await edit("ACTIVE", {}, images)).toBe("PENDING");
      expect(prisma.listingImage.deleteMany).toHaveBeenCalledWith({ where: { listingId: 9 } });
      expect(prisma.listingImage.createMany).toHaveBeenCalledWith({ data: images.map((url, position) => ({ url, position, listingId: 9 })) });
    });

    it("records the price even when other changes send the listing back to review", async () => {
      expect(await edit("ACTIVE", { price: 120000, title: "Bigger flat" })).toBe("PENDING");
      expect(prisma.listingPriceChange.create).toHaveBeenCalled();
    });

    it.each([["DRAFT"], ["PENDING"]])("sends a %s listing for review, without a price record", async (status) => {
      expect(await edit(status, { price: 1 })).toBe("PENDING");
      expect(prisma.listingPriceChange.create).not.toHaveBeenCalled();
    });

    it("only reads the owner's listing in a status that can be edited", async () => {
      prisma.listing.findFirst.mockResolvedValue(null);
      expect(await updateListing("u2", 9, draft, photos)).toBeNull();
      expect(prisma.listing.findFirst.mock.calls[0][0].where).toEqual({ id: 9, ownerId: "u2", status: { in: ["DRAFT", "PENDING", "ACTIVE"] } });
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it("leaves a listing alone that was moderated while the edit was saved", async () => {
      prisma.listing.updateMany.mockResolvedValue({ count: 0 });
      expect(await edit("ACTIVE", { price: 1 })).toBeNull();
      expect(prisma.listingImage.deleteMany).not.toHaveBeenCalled();
      expect(prisma.listingPriceChange.create).not.toHaveBeenCalled();
    });
  });

  describe("saveDraft", () => {
    it("starts a draft with neutral values for what is not filled in yet", async () => {
      prisma.listing.count.mockResolvedValue(0);
      prisma.listing.create.mockResolvedValue({ id: 11 });
      expect(await saveDraft("u1", null, { deal: "sale", type: "apartment", city: "თბილისი" }, [])).toBe(11);
      expect(prisma.listing.create.mock.calls[0][0].data).toMatchObject({ status: "DRAFT", verified: false, ownerId: "u1", agentId: null, title: "", description: "", price: 0, area: 0, currency: "USD", priceUsd: 0, pricePerSqmUsd: 0, hidePhone: false, district: null });
    });

    it("starts a broker's draft as the broker's", async () => {
      prisma.listing.count.mockResolvedValue(0);
      prisma.listing.create.mockResolvedValue({ id: 11 });
      await saveDraft("u1", null, draft, [], "a1");
      expect(prisma.listing.create.mock.calls[0][0].data.agentId).toBe("a1");
    });

    it("refuses a new draft past the limit", async () => {
      prisma.listing.count.mockResolvedValue(10);
      expect(await saveDraft("u1", null, draft, [])).toBeNull();
      expect(prisma.listing.count).toHaveBeenCalledWith({ where: { ownerId: "u1", status: "DRAFT" } });
      expect(prisma.listing.create).not.toHaveBeenCalled();
    });

    it("updates the user's own draft and its photos", async () => {
      expect(await saveDraft("u1", 9, draft, photos)).toBe(9);
      expect(prisma.listing.updateMany.mock.calls[0][0].where).toEqual({ id: 9, ownerId: "u1", status: "DRAFT" });
      expect(prisma.listingImage.createMany).toHaveBeenCalled();
    });

    it("leaves anything that is not the user's draft alone", async () => {
      prisma.listing.updateMany.mockResolvedValue({ count: 0 });
      expect(await saveDraft("u2", 9, draft, photos)).toBeNull();
      expect(prisma.listingImage.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("getEditableListing", () => {
    it("gives the owner the form's values, blanks included", async () => {
      prisma.listing.findFirst.mockResolvedValue({ ...stored, status: "ACTIVE", building: "NEW", cadastralCode: "01.10", hidePhone: true, lat: 41.7 });
      const editable = await getEditableListing("u1", "9");
      expect(editable).toMatchObject({ id: 9, status: "ACTIVE", images: photos });
      expect(editable?.fields).toMatchObject({ deal: "sale", type: "apartment", building: "new", price: "100000", area: "50", rooms: "2", features: "balcony|lift", hidePhone: "on", cadastralCode: "01.10", lat: "41.7", floor: "" });
      expect(prisma.listing.findFirst.mock.calls[0][0].where).toEqual({ id: 9, ownerId: "u1", status: { in: ["DRAFT", "PENDING", "ACTIVE"] } });
    });

    it("leaves the zeros of an unfinished draft blank", async () => {
      prisma.listing.findFirst.mockResolvedValue({ ...stored, status: "DRAFT", price: 0, area: 0 });
      expect((await getEditableListing("u1", "9"))?.fields).toMatchObject({ price: "", area: "", building: "", hidePhone: "" });
    });

    it("finds nothing for a malformed id or someone else's listing", async () => {
      expect(await getEditableListing("u1", "nine")).toBeNull();
      expect(prisma.listing.findFirst).not.toHaveBeenCalled();
      prisma.listing.findFirst.mockResolvedValue(null);
      expect(await getEditableListing("u2", "9")).toBeNull();
    });
  });

  it("finds photos that belong to someone else's listing", async () => {
    expect(await photosOfOthers("u1", [])).toBe(false);
    expect(prisma.listingImage.count).not.toHaveBeenCalled();
    prisma.listingImage.count.mockResolvedValue(1);
    expect(await photosOfOthers("u1", photos)).toBe(true);
    expect(prisma.listingImage.count).toHaveBeenCalledWith({ where: { url: { in: photos }, listing: { ownerId: { not: "u1" } } } });
    prisma.listingImage.count.mockResolvedValue(0);
    expect(await photosOfOthers("u1", photos)).toBe(false);
  });

  it("reads whether the user hides their number by default", async () => {
    prisma.user.findUnique.mockResolvedValue({ hidePhoneDefault: true });
    expect(await hidesPhoneByDefault("u1")).toBe(true);
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await hidesPhoneByDefault("u1")).toBe(false);
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
    await searchListings(filters, { sort: "asc" });
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
