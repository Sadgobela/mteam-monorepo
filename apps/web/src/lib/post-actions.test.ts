import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ priceStats: vi.fn() }));
vi.mock("@mteam/db", () => db);

import { marketStatsAction } from "./post-actions";

beforeEach(() => vi.resetAllMocks());

describe("marketStatsAction", () => {
  it("gives the typical prices of a city for sale or rent", async () => {
    db.priceStats.mockResolvedValue([{ district: "ვაკე", rooms: 2, median: 2000 }]);
    expect(await marketStatsAction("თბილისი", "rent")).toEqual([{ district: "ვაკე", rooms: 2, median: 2000 }]);
    expect(db.priceStats).toHaveBeenCalledWith("თბილისი", "rent");
  });

  it.each([
    ["an unknown city", "Atlantis", "sale"],
    ["a deal the data does not cover", "თბილისი", "daily"],
  ])("asks nothing for %s", async (_name, city, deal) => {
    expect(await marketStatsAction(city, deal)).toEqual([]);
    expect(db.priceStats).not.toHaveBeenCalled();
  });
});
