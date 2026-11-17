// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getGelPerUsd: vi.fn(), getListing: vi.fn(), listSimilarListings: vi.fn() }));
vi.mock("@mteam/db", () => db);

import { GET } from "./route";

const get = async (id: string) => {
  const response = await GET(new Request(`http://localhost/api/v1/listings/${id}`), { params: Promise.resolve({ id }) });
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  db.getGelPerUsd.mockResolvedValue(2.7);
});

describe("GET /api/v1/listings/[id]", () => {
  it("returns the listing and similar ones without phone numbers", async () => {
    db.getListing.mockResolvedValue({ id: 5, contactPhone: "+995555000000" });
    db.listSimilarListings.mockResolvedValue([{ id: 6, contactPhone: "+995555111111" }]);
    expect(await get("5")).toEqual([200, { listing: { id: 5 }, similar: [{ id: 6 }], gelPerUsd: 2.7 }]);
    expect(db.getListing).toHaveBeenCalledWith("5");
  });

  it("says not found for an unknown or unpublished listing", async () => {
    db.getListing.mockResolvedValue(undefined);
    expect(await get("x")).toEqual([404, { error: "notFound" }]);
    expect(db.listSimilarListings).not.toHaveBeenCalled();
  });
});
