import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const actions = vi.hoisted(() => ({ marketStatsAction: vi.fn() }));
vi.mock("@/lib/post-actions", () => actions);

import { PriceHint } from "./PriceHint";

const t = getDictionary("en");
const flat = { deal: "sale", type: "apartment", city: "თბილისი", district: "ვაკე", rooms: "2", area: "50", price: "100000", currency: "USD" };
const show = (change: Record<string, string> = {}) => render(<PriceHint values={{ ...flat, ...change }} gelPerUsd={2.5} t={t} />);

beforeEach(() => {
  vi.resetAllMocks();
  // $2,000 per m² is typical for a 2-room flat in Vake, $1,500 for 4 rooms or more in Batumi as a whole.
  actions.marketStatsAction.mockResolvedValue([
    { district: "ვაკე", rooms: 2, median: 2000 },
    { district: "ბათუმი", rooms: 4, median: 1500 },
  ]);
});

describe("PriceHint", () => {
  it.each([
    ["100000", t.post.market.at],
    ["104000", t.post.market.at],
    ["90000", t.post.market.below],
    ["110000", t.post.market.above],
  ])("places a price of $%s for 50 m² against the district", async (price, position) => {
    show({ price });
    expect(await screen.findByRole("status")).toHaveTextContent(`${position} ${t.post.market.typical.replace("{price}", "$2,000")}`);
    expect(actions.marketStatsAction).toHaveBeenCalledWith("თბილისი", "sale");
  });

  it("compares a price in lari at the stored rate, and quotes the typical figure in lari", async () => {
    show({ price: "250000", currency: "GEL" });
    expect(await screen.findByRole("status")).toHaveTextContent(`${t.post.market.at} ${t.post.market.typical.replace("{price}", "₾5,000")}`);
  });

  it("uses the city where there are no districts, and the top room count for bigger flats", async () => {
    show({ city: "ბათუმი", district: "", rooms: "6", price: "75000" });
    expect(await screen.findByRole("status")).toHaveTextContent(t.post.market.at);
  });

  it.each([
    ["no price yet", { price: "" }],
    ["no area yet", { area: "" }],
    ["no figure for the room count", { rooms: "3" }],
  ])("shows nothing with %s", async (_name, change) => {
    show(change);
    await waitFor(() => expect(actions.marketStatsAction).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["a house", { type: "house" }],
    ["a daily rental", { deal: "daily" }],
    ["no city", { city: "" }],
  ])("does not ask for figures for %s, which the market data does not cover", (_name, change) => {
    show(change);
    expect(actions.marketStatsAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ignores figures for a city no longer chosen", async () => {
    let answer: (rows: unknown[]) => void = () => undefined;
    actions.marketStatsAction.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { rerender } = show();
    rerender(<PriceHint values={{ ...flat, city: "ბათუმი", district: "", rooms: "4", price: "75000" }} gelPerUsd={2.5} t={t} />);
    answer([{ district: "ვაკე", rooms: 2, median: 2000 }]);
    expect(await screen.findByRole("status")).toHaveTextContent("$1,500");
  });
});
