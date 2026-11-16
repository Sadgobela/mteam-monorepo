import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({
  bumpListing: vi.fn(),
  deleteDraft: vi.fn(),
  countMyListings: vi.fn(),
  listMyListingsTab: vi.fn(),
  myListingTabs: ["active", "pending", "draft", "expiring", "archived", "rejected"] as const,
  parseListingId: vi.fn(),
  renewListing: vi.fn(),
  archiveListing: vi.fn(),
  deleteSavedSearch: vi.fn(),
  openSavedSearch: vi.fn(),
  saveSearch: vi.fn(),
  setFavorite: vi.fn(),
  setHidden: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), signInHere: async (locale: string) => `/${locale}/login?next=%2F${locale}%2Fhere` }));
const revalidatePath = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { bumpListingAction, deleteDraftAction, renewListingAction } from "@/lib/my-listings-actions";
import MyListingsPage from "./[locale]/(account)/my-listings/page";

const t = getDictionary("en");
const my = t.myListings;
const params = Promise.resolve({ locale: "en" });
const open = (query: Record<string, string | string[]> = {}) => MyListingsPage({ params, searchParams: Promise.resolve(query) });
const counts = { active: 2, pending: 1, draft: 0, expiring: 1, archived: 1, rejected: 0 };
const mine = (overrides: Record<string, unknown> = {}) => ({
  listing: fixtureListings[1],
  status: "ACTIVE",
  views: 40,
  phoneReveals: 3,
  favorites: 5,
  conversations: 2,
  canRenew: false,
  canBump: false,
  ...overrides,
});
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1", role: "USER" });
  db.countMyListings.mockResolvedValue(counts);
  db.listMyListingsTab.mockResolvedValue([]);
  db.parseListingId.mockReturnValue(7);
});

describe("MyListingsPage", () => {
  it("requires a session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(open()).rejects.toThrow("REDIRECT /en/login");
  });

  it("explains an empty account, without tabs", async () => {
    db.countMyListings.mockResolvedValue({ active: 0, pending: 0, draft: 0, expiring: 0, archived: 0, rejected: 0 });
    render(await open());
    expect(screen.getByText(t.my.empty)).toBeInTheDocument();
    expect(screen.queryByRole("search")).toBeNull();
    expect(db.listMyListingsTab).toHaveBeenCalledWith("u1", { tab: "active", q: "", sort: "new" });
  });

  it("opens the first tab with something in it, and shows every tab's count", async () => {
    db.countMyListings.mockResolvedValue({ ...counts, active: 0, expiring: 0 });
    render(await open());
    expect(db.listMyListingsTab).toHaveBeenCalledWith("u1", { tab: "pending", q: "", sort: "new" });
    expect(screen.getByText("Under review (1)")).toBeInTheDocument();
    expect(screen.getByText("Ending soon (0)")).toBeInTheDocument();
    expect(screen.getByText(my.emptyTab)).toBeInTheDocument();
  });

  it("keeps the search and sort in each tab's link, and ignores what it does not know", async () => {
    render(await open({ tab: "archived", q: "  vake ", sort: "desc" }));
    expect(db.listMyListingsTab).toHaveBeenCalledWith("u1", { tab: "archived", q: "vake", sort: "desc" });
    expect(screen.getByRole("textbox", { name: my.search })).toHaveValue("vake");
    expect(screen.getByDisplayValue("desc")).toHaveAttribute("name", "sort");
    db.listMyListingsTab.mockClear();
    render(await open({ tab: "nope", q: ["a", "b"], sort: "sideways" }));
    expect(db.listMyListingsTab).toHaveBeenCalledWith("u1", { tab: "active", q: "", sort: "new" });
  });

  it("shows each listing's numbers, market level and end date, with the actions it allows", async () => {
    db.listMyListingsTab.mockResolvedValue([
      mine({ listing: { ...fixtureListings[0], images: ["https://cdn/a.jpg"], marketLevel: 2 }, expiresAt: new Date("2026-12-20T10:00:00Z"), canRenew: true, canBump: true }),
    ]);
    render(await open());
    const { id, title } = fixtureListings[0];
    expect(screen.getByRole("img", { name: title })).toHaveAttribute("src", "https://cdn/a.jpg");
    expect(screen.getByText(`No. ${id}`)).toBeInTheDocument();
    for (const text of ["Views: 40", "Number shown: 3", "In favourites: 5", "Chats: 2", "Active until Dec 20"]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText(`${t.market.heading}: ${t.market.levels[1]}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: my.open })).toHaveAttribute("href", `/en/listings/${id}`);
    expect(screen.getByRole("link", { name: my.edit })).toHaveAttribute("href", `/en/listings/${id}/edit`);
    expect(screen.getByRole("button", { name: my.bump })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: my.renew })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.my.archive })).toBeInTheDocument();
  });

  it("says when the next free move up comes, and offers renewal for one that ran out", async () => {
    db.listMyListingsTab.mockResolvedValue([
      mine({ nextBumpAt: new Date("2026-11-17T08:30:00Z") }),
      mine({ listing: fixtureListings[2], status: "ARCHIVED", canRenew: true }),
      mine({ listing: { ...fixtureListings[0], id: 1 }, status: "PENDING" }),
      mine({ listing: { ...fixtureListings[0], id: 2 }, status: "REJECTED" }),
    ]);
    render(await open());
    expect(screen.getByText("Next free move up: Nov 17, 12:30 PM")).toBeInTheDocument();
    expect(screen.getByText(my.expired)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: my.bump })).toBeNull();
    expect(screen.getAllByRole("button", { name: my.renew })).toHaveLength(1);
    // Archive for the published and the pending one; open only for the published one.
    expect(screen.getAllByRole("button", { name: t.my.archive })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: my.open })).toHaveLength(1);
    expect(screen.getByText(t.my.status.REJECTED)).toBeInTheDocument();
  });

  it("links staff to the admin panel, and nobody else", async () => {
    session.currentUser.mockResolvedValue({ id: "u1", role: "AGENT" });
    const staff = render(await open());
    expect(screen.getByRole("link", { name: t.admin.heading })).toHaveAttribute("href", "/en/admin");
    staff.unmount();
    session.currentUser.mockResolvedValue({ id: "u1", role: "USER" });
    render(await open());
    expect(screen.queryByRole("link", { name: t.admin.heading })).toBeNull();
  });
});

describe("my listings actions", () => {
  const body = { locale: "en", listingId: "7" };

  it.each([
    ["bumps", bumpListingAction, db.bumpListing],
    ["renews", renewListingAction, db.renewListing],
    ["deletes a draft", deleteDraftAction, db.deleteDraft],
  ] as const)("%s only through the signed-in user, refreshes and says whether it was done", async (_name, action, write) => {
    write.mockResolvedValue(true);
    expect(await action(form(body))).toBe(true);
    write.mockResolvedValue(false);
    expect(await action(form(body))).toBe(false);
    expect(db.parseListingId).toHaveBeenCalledWith("7");
    expect(write).toHaveBeenCalledWith("u1", 7);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sends a visitor to sign in without acting", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(bumpListingAction(form(body))).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Fhere");
    expect(db.bumpListing).not.toHaveBeenCalled();
  });

  it("ignores an invalid id", async () => {
    db.parseListingId.mockReturnValue(null);
    expect(await renewListingAction(form({ locale: "en", listingId: "x" }))).toBe(false);
    expect(db.renewListing).not.toHaveBeenCalled();
  });
});
