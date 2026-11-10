import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ PAGE_SIZE: 24, countListings: vi.fn(), deleteSavedSearch: vi.fn(), getFavoriteIds: vi.fn(), getHiddenIds: vi.fn(), isSearchSaved: vi.fn(), listSavedSearches: vi.fn(), openSavedSearch: vi.fn(), parseListingId: vi.fn(), saveSearch: vi.fn(), searchListings: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const cacheApi = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => cacheApi);
vi.mock("@/lib/lead-actions", () => ({ leadAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { SaveSearch } from "@/components/SaveSearch";
import { deleteSavedSearchAction, openSavedSearchAction, saveSearchAction } from "@/lib/account-actions";
import HomePage from "./[locale]/page";
import SavedSearchesPage from "./[locale]/saved/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  data.set("locale", "en");
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("SaveSearch", () => {
  it("offers to save, sends visitors to sign in, and says when it is done", () => {
    const { rerender, container } = render(<SaveSearch locale="en" t={t} query="deal=sale" signedIn saved={false} />);
    expect(screen.getByRole("button", { name: t.saved.save })).toBeInTheDocument();
    expect(container.querySelector('input[name="query"]')).toHaveValue("deal=sale");
    rerender(<SaveSearch locale="en" t={t} query="deal=sale" signedIn={false} saved={false} />);
    expect(screen.getByRole("link", { name: t.saved.save })).toHaveAttribute("href", "/en/login");
    rerender(<SaveSearch locale="en" t={t} query="deal=sale" signedIn saved />);
    expect(screen.getByText(t.saved.done)).toBeInTheDocument();
  });
});

describe("results page", () => {
  const results = async (query: Record<string, string>) => render(await HomePage({ params, searchParams: Promise.resolve(query) }));

  beforeEach(() => {
    db.searchListings.mockResolvedValue([]);
    db.countListings.mockResolvedValue(0);
    db.getFavoriteIds.mockResolvedValue([]);
    db.getHiddenIds.mockResolvedValue([]);
  });

  it("offers to save a search once, and not when nothing is filtered", async () => {
    db.isSearchSaved.mockResolvedValue(false);
    const first = await results({ deal: "sale", sort: "asc" });
    expect(db.isSearchSaved).toHaveBeenCalledWith("u1", "deal=sale");
    expect(screen.getByRole("button", { name: t.saved.save })).toBeInTheDocument();
    first.unmount();

    db.isSearchSaved.mockResolvedValue(true);
    const second = await results({ deal: "sale" });
    expect(screen.getByText(t.saved.done)).toBeInTheDocument();
    second.unmount();

    db.isSearchSaved.mockClear();
    await results({ deal: "" });
    expect(db.isSearchSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: t.saved.save })).toBeNull();
  });
});

describe("SavedSearchesPage", () => {
  it("sends visitors to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(SavedSearchesPage({ params })).rejects.toThrow("REDIRECT /en/login");
  });

  it("explains an empty list", async () => {
    db.listSavedSearches.mockResolvedValue([]);
    render(await SavedSearchesPage({ params }));
    expect(screen.getByText(t.saved.empty)).toBeInTheDocument();
  });

  it("names each search, its extra filters and what is new", async () => {
    db.listSavedSearches.mockResolvedValue([
      { id: "s1", query: "deal=sale", filters: { deal: "sale", rooms: 2, city: undefined }, newCount: 3 },
      { id: "s2", query: "rooms=2", filters: { rooms: 2 }, newCount: 0 },
    ]);
    render(await SavedSearchesPage({ params }));
    expect(screen.getByText("For sale +1")).toBeInTheDocument();
    expect(screen.getByText("All listings +1")).toBeInTheDocument();
    expect(screen.getAllByText(/^New:/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: t.saved.remove })).toHaveLength(2);
  });

  it("does not show a count of extras when there are none", async () => {
    db.listSavedSearches.mockResolvedValue([{ id: "s1", query: "deal=sale", filters: { deal: "sale" }, newCount: 0 }]);
    const { container } = render(await SavedSearchesPage({ params }));
    expect(container.querySelector(".saved-list b")).toHaveTextContent(/^For sale$/);
  });
});

describe("saved search actions", () => {
  it("need a signed-in user", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(saveSearchAction(form({ query: "deal=sale" }))).rejects.toThrow("REDIRECT /en/login");
    expect(db.saveSearch).not.toHaveBeenCalled();
  });

  it("save only the filters that mean something", async () => {
    db.saveSearch.mockResolvedValue(true);
    await saveSearchAction(form({ query: "sort=asc&deal=sale&page=3" }));
    expect(db.saveSearch).toHaveBeenCalledWith("u1", "deal=sale");
    expect(cacheApi.revalidatePath).toHaveBeenCalled();
  });

  it("do not save a search with no filters", async () => {
    await saveSearchAction(form({ query: "sort=asc" }));
    expect(db.saveSearch).not.toHaveBeenCalled();
  });

  it("go to the list at the limit, where one can be removed", async () => {
    db.saveSearch.mockResolvedValue(false);
    await expect(saveSearchAction(form({ query: "deal=sale" }))).rejects.toThrow("REDIRECT /en/saved");
  });

  it("remove a search, passing nothing unsafe as its id", async () => {
    await deleteSavedSearchAction(form({ id: "s1" }));
    expect(db.deleteSavedSearch).toHaveBeenCalledWith("u1", "s1");
    await deleteSavedSearchAction(form({ id: "bad id" }));
    expect(db.deleteSavedSearch).toHaveBeenLastCalledWith("u1", "");
  });

  it("open a search at its results, or back at the list if it is gone", async () => {
    db.openSavedSearch.mockResolvedValue("deal=sale");
    await expect(openSavedSearchAction(form({ id: "s1" }))).rejects.toThrow("REDIRECT /en?deal=sale");
    db.openSavedSearch.mockResolvedValue(null);
    await expect(openSavedSearchAction(form({ id: "s1" }))).rejects.toThrow("REDIRECT /en/saved");
  });
});
