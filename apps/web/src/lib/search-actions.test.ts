// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ countListings: vi.fn(async () => 34), getHiddenIds: vi.fn(async () => [5]) }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("./session", () => session);

import { countSearchAction } from "./search-actions";

beforeEach(() => vi.clearAllMocks());

describe("countSearchAction", () => {
  it("counts a search's listings, ignoring unknown parameters", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await countSearchAction("deal=sale&rooms=2&castle=1")).toBe(34);
    expect(db.countListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "sale", rooms: 2 }), { hiddenIds: [] });
    expect(db.countListings.mock.calls[0]).not.toHaveProperty("0.castle");
  });

  it("leaves out listings the visitor hid", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    await countSearchAction("deal=rent");
    expect(db.getHiddenIds).toHaveBeenCalledWith("u1");
    expect(db.countListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "rent" }), { hiddenIds: [5] });
  });
});
