import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({
  archiveListing: vi.fn(),
  countListings: vi.fn(),
  getFavoriteIds: vi.fn(),
  listFavorites: vi.fn(),
  listMyListings: vi.fn(),
  PAGE_SIZE: 24,
  parseListingId: vi.fn(),
  searchListings: vi.fn(),
  toggleFavorite: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { Header } from "@/components/Header";
import { archiveListingAction, toggleFavoriteAction } from "@/lib/account-actions";
import HomePage from "./[locale]/page";
import FavoritesPage from "./[locale]/favorites/page";
import MyListingsPage from "./[locale]/my-listings/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  db.parseListingId.mockReturnValue(7);
});

describe("account actions", () => {
  const body = { locale: "en", listingId: "7" };

  it("toggles a favourite for the signed-in user and refreshes", async () => {
    await toggleFavoriteAction(form(body));
    expect(db.parseListingId).toHaveBeenCalledWith("7");
    expect(db.toggleFavorite).toHaveBeenCalledWith("u1", 7);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("archives only through the signed-in user", async () => {
    await archiveListingAction(form(body));
    expect(db.archiveListing).toHaveBeenCalledWith("u1", 7);
  });

  it("sends a visitor to login without acting", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(toggleFavoriteAction(form(body))).rejects.toThrow("REDIRECT /en/login");
    expect(db.toggleFavorite).not.toHaveBeenCalled();
  });

  it("ignores an invalid id", async () => {
    db.parseListingId.mockReturnValue(null);
    await toggleFavoriteAction(form({ locale: "en", listingId: "x" }));
    expect(db.toggleFavorite).not.toHaveBeenCalled();
  });
});

describe("favourite hearts on the home page", () => {
  beforeEach(() => db.searchListings.mockResolvedValue(fixtureListings));

  it("marks a signed-in user's favourites", async () => {
    db.getFavoriteIds.mockResolvedValue([fixtureListings[0].id]);
    render(await HomePage({ params, searchParams: Promise.resolve({}) }));
    expect(db.getFavoriteIds).toHaveBeenCalledWith("u1");
    expect(screen.getAllByRole("button", { name: t.favorites.remove })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: t.favorites.add })).toHaveLength(fixtureListings.length - 1);
    expect(screen.getByRole("button", { name: t.favorites.remove })).toHaveAttribute("aria-pressed", "true");
  });

  it("sends a visitor's heart to login without a query", async () => {
    session.currentUser.mockResolvedValue(null);
    render(await HomePage({ params, searchParams: Promise.resolve({}) }));
    expect(db.getFavoriteIds).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: t.favorites.add })[0]).toHaveAttribute("href", "/en/login");
  });
});

describe("FavoritesPage", () => {
  it("requires a session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(FavoritesPage({ params })).rejects.toThrow("REDIRECT /en/login");
  });

  it("shows saved listings, all marked", async () => {
    db.listFavorites.mockResolvedValue(fixtureListings);
    render(await FavoritesPage({ params }));
    expect(db.listFavorites).toHaveBeenCalledWith("u1");
    expect(screen.getAllByRole("button", { name: t.favorites.remove })).toHaveLength(fixtureListings.length);
  });

  it("explains an empty list", async () => {
    db.listFavorites.mockResolvedValue([]);
    render(await FavoritesPage({ params }));
    expect(screen.getByText(t.favorites.empty)).toBeInTheDocument();
  });
});

describe("MyListingsPage", () => {
  const entry = (status: string, index: number) => ({ status, listing: fixtureListings[index] });

  it("requires a session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(MyListingsPage({ params })).rejects.toThrow("REDIRECT /en/login");
  });

  it("links only published listings and offers archive until archived", async () => {
    db.listMyListings.mockResolvedValue([entry("ACTIVE", 0), entry("PENDING", 1), entry("ARCHIVED", 2)]);
    render(await MyListingsPage({ params }));
    expect(db.listMyListings).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("link", { name: fixtureListings[0].title })).toHaveAttribute("href", `/en/listings/${fixtureListings[0].id}`);
    expect(screen.queryByRole("link", { name: fixtureListings[1].title })).toBeNull();
    expect(screen.getByText(t.my.status.PENDING)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: t.my.archive })).toHaveLength(2);
  });

  it("explains an empty list", async () => {
    db.listMyListings.mockResolvedValue([]);
    render(await MyListingsPage({ params }));
    expect(screen.getByText(t.my.empty)).toBeInTheDocument();
  });
});

describe("Header account links", () => {
  it("links to the account pages when signed in", () => {
    render(<Header locale="en" t={t} signedIn />);
    expect(screen.getByRole("link", { name: t.nav.favorites })).toHaveAttribute("href", "/en/favorites");
    expect(screen.getByRole("link", { name: t.nav.my })).toHaveAttribute("href", "/en/my-listings");
  });

  it("hides them from a visitor", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.queryByRole("link", { name: t.nav.favorites })).toBeNull();
  });
});
