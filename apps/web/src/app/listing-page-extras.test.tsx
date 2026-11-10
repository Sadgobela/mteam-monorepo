import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({
  countSellerListings: vi.fn(),
  getFavoriteIds: vi.fn(),
  getHiddenIds: vi.fn(),
  getListing: vi.fn(),
  listSellerListings: vi.fn(),
  listSimilarListings: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), clientIp: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/account-actions", () => ({ setHiddenAction: vi.fn(), setFavoriteAction: vi.fn() }));
vi.mock("@/lib/report-actions", () => ({ reportListingAction: vi.fn() }));
vi.mock("@/lib/lead-actions", () => ({ leadAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ListingPage from "./[locale]/listings/[id]/page";
import SellerPage from "./[locale]/sellers/[id]/page";

const [brokered, rental] = fixtureListings;
const owned = { ...brokered, agent: undefined };
const open = async () => render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "1" }), searchParams: Promise.resolve({}) }));

beforeEach(() => {
  vi.clearAllMocks();
  session.currentUser.mockResolvedValue(null);
  db.getFavoriteIds.mockResolvedValue([]);
  db.getHiddenIds.mockResolvedValue([]);
  db.listSimilarListings.mockResolvedValue([]);
  db.countSellerListings.mockResolvedValue(1);
});

describe("listing page extras", () => {
  it("sends a visitor to sign in to hide a listing", async () => {
    db.getListing.mockResolvedValue(brokered);
    await open();
    expect(screen.getByRole("link", { name: "Hide from results" })).toHaveAttribute("href", "/en/login");
    expect(db.countSellerListings).not.toHaveBeenCalled();
  });

  it("offers a signed-in user to hide, or to bring back", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    db.getListing.mockResolvedValue(brokered);
    await open();
    expect(screen.getByRole("button", { name: "Hide from results" })).toBeInTheDocument();
    db.getHiddenIds.mockResolvedValue([brokered.id]);
    await open();
    expect(screen.getByRole("button", { name: "Show in results again" })).toBeInTheDocument();
  });

  it("links an owner's other listings only when there are others", async () => {
    db.getListing.mockResolvedValue(owned);
    db.countSellerListings.mockResolvedValue(3);
    await open();
    expect(screen.getByRole("link", { name: "All listings (3)" })).toHaveAttribute("href", "/en/sellers/seller1");
  });

  it("does not link a lone listing's owner", async () => {
    db.getListing.mockResolvedValue(owned);
    await open();
    expect(screen.queryByRole("link", { name: /All listings/ })).toBeNull();
  });

  it("places the price on the market scale only when it is known", async () => {
    db.getListing.mockResolvedValue({ ...brokered, marketLevel: 2 });
    const { container, unmount } = await open();
    expect(screen.getByText("Below market")).toBeInTheDocument();
    expect(container.querySelectorAll(".market-bar span")).toHaveLength(5);
    expect(container.querySelectorAll(".market-bar span")[1]).toHaveAttribute("data-on");
    expect(container.querySelectorAll(".market-bar span")[0]).not.toHaveAttribute("data-on");
    unmount();
    db.getListing.mockResolvedValue(brokered);
    await open();
    expect(screen.queryByText("Price compared with the market")).toBeNull();
  });

  it("shows similar listings when there are any", async () => {
    db.getListing.mockResolvedValue(brokered);
    db.listSimilarListings.mockResolvedValue([rental]);
    await open();
    expect(screen.getByRole("heading", { name: "Similar listings" })).toBeInTheDocument();
  });

  it("offers the loan calculator on sales in the chosen currency, and not on rentals", async () => {
    db.getListing.mockResolvedValue(brokered);
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "1" }), searchParams: Promise.resolve({ cur: "gel" }) }));
    expect(screen.getByRole("heading", { name: "Loan calculator" })).toBeInTheDocument();
    expect(screen.getByText(/Mortgage per month: ₾/)).toBeInTheDocument();
    db.getListing.mockResolvedValue(rental);
    document.body.innerHTML = "";
    await open();
    expect(screen.queryByRole("heading", { name: "Loan calculator" })).toBeNull();
  });
});

describe("SellerPage", () => {
  const seller = () => SellerPage({ params: Promise.resolve({ locale: "en", id: "seller1" }) });

  it("shows the seller's listings", async () => {
    db.listSellerListings.mockResolvedValue([owned]);
    render(await seller());
    expect(screen.getByRole("heading", { name: "Listings by this seller" })).toBeInTheDocument();
  });

  it("marks favourites for a signed-in user", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    db.listSellerListings.mockResolvedValue([owned]);
    db.getFavoriteIds.mockResolvedValue([owned.id]);
    render(await seller());
    expect(db.getFavoriteIds).toHaveBeenCalledWith("u1");
  });

  it("is not found without any listings", async () => {
    db.listSellerListings.mockResolvedValue([]);
    await expect(seller()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
