import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ getGelPerUsd: async () => 2.7,
  archiveListing: vi.fn(),
  countListings: vi.fn(),
  getFavoriteIds: vi.fn(),
  getHiddenIds: vi.fn(async () => []),
  setHidden: vi.fn(),
  listFavorites: vi.fn(),
  PAGE_SIZE: 24,
  parseListingId: vi.fn(),
  searchListings: vi.fn(),
  setFavorite: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn(), signInHere: async (locale: string) => `/${locale}/login?next=%2F${locale}%2Fhere` }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { Header } from "@/components/Header";
import { archiveListingAction, setFavoriteAction, setHiddenAction } from "@/lib/account-actions";
import HomePage from "./[locale]/(home)/page";
import FavoritesPage from "./[locale]/(account)/favorites/page";

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

  it("saves a favourite for the signed-in user and refreshes", async () => {
    await setFavoriteAction(form({ ...body, want: "1" }));
    expect(db.parseListingId).toHaveBeenCalledWith("7");
    expect(db.setFavorite).toHaveBeenCalledWith("u1", 7, true);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("removes a favourite when asked", async () => {
    await setFavoriteAction(form({ ...body, want: "0" }));
    expect(db.setFavorite).toHaveBeenCalledWith("u1", 7, false);
  });

  it("archives only through the signed-in user", async () => {
    await archiveListingAction(form(body));
    expect(db.archiveListing).toHaveBeenCalledWith("u1", 7);
  });

  it("sends a visitor to login without acting", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(setFavoriteAction(form(body))).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Fhere");
    expect(db.setFavorite).not.toHaveBeenCalled();
  });

  it("ignores an invalid id", async () => {
    db.parseListingId.mockReturnValue(null);
    await setFavoriteAction(form({ locale: "en", listingId: "x" }));
    expect(db.setFavorite).not.toHaveBeenCalled();
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
  });

  it("sends a visitor's heart to login without a query", async () => {
    session.currentUser.mockResolvedValue(null);
    render(await HomePage({ params, searchParams: Promise.resolve({}) }));
    expect(db.getFavoriteIds).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: t.favorites.add })[0]).toHaveAttribute("href", "/en/login?next=%2Fen");
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

describe("setHiddenAction", () => {
  it("hides and shows a listing for the signed-in user", async () => {
    session.currentUser.mockResolvedValue({ id: "u1", role: "USER" });
    db.parseListingId.mockReturnValue(7);
    await setHiddenAction(form({ locale: "en", listingId: "7", want: "1" }));
    expect(db.setHidden).toHaveBeenLastCalledWith("u1", 7, true);
    await setHiddenAction(form({ locale: "en", listingId: "7", want: "0" }));
    expect(db.setHidden).toHaveBeenLastCalledWith("u1", 7, false);
  });
});

describe("Header account links", () => {
  it("gathers the account pages in one menu when signed in", async () => {
    render(<Header locale="en" t={t} signedIn />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.nav.account) }));
    expect(await screen.findByRole("link", { name: t.nav.favorites })).toHaveAttribute("href", "/en/favorites");
    expect(screen.getByRole("link", { name: t.nav.saved })).toHaveAttribute("href", "/en/saved");
    expect(screen.getByRole("link", { name: t.nav.messages })).toHaveAttribute("href", "/en/messages");
    expect(screen.getByRole("link", { name: t.nav.my })).toHaveAttribute("href", "/en/my-listings");
  });

  it("hides them from a visitor", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.queryByRole("button", { name: new RegExp(t.nav.account) })).toBeNull();
  });
});
