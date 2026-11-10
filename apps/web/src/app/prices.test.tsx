import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ priceStats: vi.fn() }));
const session = vi.hoisted(() => ({ hasSession: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

import PricesPage from "./[locale]/prices/page";

const t = getDictionary("en");
const open = async (query: Record<string, string> = {}) => render(await PricesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.resetAllMocks();
  session.hasSession.mockResolvedValue(false);
  db.priceStats.mockResolvedValue([]);
});

describe("PricesPage", () => {
  it("starts on sales in Tbilisi and explains an empty city", async () => {
    await open();
    expect(db.priceStats).toHaveBeenCalledWith("თბილისი", "sale");
    expect(screen.getByText(t.market.statsEmpty)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tbilisi" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Batumi" })).not.toHaveAttribute("aria-current");
  });

  it("follows the chosen city and deal, and keeps them in its links", async () => {
    await open({ city: "ბათუმი", deal: "rent" });
    expect(db.priceStats).toHaveBeenCalledWith("ბათუმი", "rent");
    const hrefs = screen.getAllByRole("link", { name: "For sale" }).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/en/prices?city=${encodeURIComponent("ბათუმი")}&deal=sale`);
  });

  it("treats other deal types as sales", async () => {
    await open({ deal: "daily" });
    expect(db.priceStats).toHaveBeenCalledWith("თბილისი", "sale");
  });

  it("shows a district's prices by room count, with a dash where there are too few", async () => {
    db.priceStats.mockResolvedValue([
      { district: "ვაკე", rooms: 2, median: 1550 },
      { district: "ვაკე", rooms: 4, median: 2100 },
    ]);
    await open();
    expect(screen.getByRole("columnheader", { name: "2-room" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "4+ rooms" })).toBeInTheDocument();
    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual(["–", "$1,550", "–", "$2,100"]);
    expect(screen.getByRole("rowheader", { name: "Vake" })).toBeInTheDocument();
  });
});
