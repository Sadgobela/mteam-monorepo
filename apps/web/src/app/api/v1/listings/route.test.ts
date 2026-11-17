// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ countListings: vi.fn(), getGelPerUsd: vi.fn(), searchListings: vi.fn(), PAGE_SIZE: 24 }));
vi.mock("@mteam/db", () => db);

import { GET } from "./route";

const get = async (search = "") => {
  const response = await GET(new Request(`http://localhost/api/v1/listings${search}`));
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  db.searchListings.mockResolvedValue([{ id: 3, title: "Flat", contactPhone: "+995555000000" }]);
  db.countListings.mockResolvedValue(30);
  db.getGelPerUsd.mockResolvedValue(2.7);
});

describe("GET /api/v1/listings", () => {
  it("returns a page of results without phone numbers, with the total and the rate", async () => {
    expect(await get("?deal=sale&sort=asc&page=2")).toEqual([200, { listings: [{ id: 3, title: "Flat" }], total: 30, page: 2, pageSize: 24, gelPerUsd: 2.7 }]);
    expect(db.searchListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "sale" }), { sort: "asc", page: 2 });
    expect(db.countListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "sale" }), { located: false });
  });

  it("falls back to the first page and newest first", async () => {
    expect((await get("?page=zero"))[1]).toMatchObject({ page: 1 });
    expect(db.searchListings).toHaveBeenCalledWith(expect.anything(), { sort: "new", page: 1 });
  });

  it("returns only located listings, on one page, for the map", async () => {
    expect((await get("?view=map&page=3"))[1]).toMatchObject({ page: 1, pageSize: 200 });
    expect(db.searchListings).toHaveBeenCalledWith(expect.anything(), { sort: "new", limit: 200, located: true });
    expect(db.countListings).toHaveBeenCalledWith(expect.anything(), { located: true });
  });
});
