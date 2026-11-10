import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ getBranch: vi.fn(), getBroker: vi.fn(), getFavoriteIds: vi.fn(), listBranches: vi.fn(), listBrokers: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/account-actions", () => ({ setFavoriteAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import BranchPage from "./[locale]/branches/[id]/page";
import BrokerPage from "./[locale]/brokers/[id]/page";
import BrokersPage from "./[locale]/brokers/page";

const t = getDictionary("en");
const broker = { id: "a1", name: "Nino", branch: "Vake", phone: "+995555000000" };

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue(null);
  session.hasSession.mockResolvedValue(false);
  db.listBranches.mockResolvedValue([]);
});

describe("BrokersPage", () => {
  const params = Promise.resolve({ locale: "en" });

  it("links to each broker with their listing count", async () => {
    db.listBrokers.mockResolvedValue([{ ...broker, listingCount: 3 }]);
    render(await BrokersPage({ params }));
    expect(screen.getByRole("link", { name: /Nino/ })).toHaveAttribute("href", "/en/brokers/a1");
    expect(screen.getByText(/Listings: 3/)).toBeInTheDocument();
  });

  it("leads with the branches when there are any", async () => {
    db.listBrokers.mockResolvedValue([{ ...broker, listingCount: 3 }]);
    db.listBranches.mockResolvedValue([{ id: "b1", name: "Vake office", city: "თბილისი", brokerCount: 2, listingCount: 5 }]);
    render(await BrokersPage({ params }));
    expect(screen.getByRole("link", { name: /Vake office/ })).toHaveAttribute("href", "/en/branches/b1");
    expect(screen.getByText("Tbilisi · Brokers: 2 · Listings: 5")).toBeInTheDocument();
  });

  it("explains an empty list", async () => {
    db.listBrokers.mockResolvedValue([]);
    render(await BrokersPage({ params }));
    expect(screen.getByText(t.brokers.empty)).toBeInTheDocument();
  });
});

describe("BranchPage", () => {
  const params = Promise.resolve({ locale: "en", id: "b1" });
  const branch = { id: "b1", name: "Vake office", city: "თბილისი", brokers: [{ ...broker, listingCount: 1 }] };

  it("shows the branch, its brokers and their listings", async () => {
    db.getBranch.mockResolvedValue({ ...branch, listings: fixtureListings });
    render(await BranchPage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: "Vake office" })).toBeInTheDocument();
    expect(screen.getByText("Tbilisi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nino/ })).toHaveAttribute("href", "/en/brokers/a1");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(fixtureListings.length);
  });

  it("marks favourites for someone signed in", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    db.getFavoriteIds.mockResolvedValue([]);
    db.getBranch.mockResolvedValue({ ...branch, listings: fixtureListings });
    render(await BranchPage({ params }));
    expect(db.getFavoriteIds).toHaveBeenCalledWith("u1");
  });

  it("says so when nothing is listed", async () => {
    db.getBranch.mockResolvedValue({ ...branch, listings: [] });
    render(await BranchPage({ params }));
    expect(screen.getByText(t.search.empty)).toBeInTheDocument();
  });

  it("is not found for an unknown branch", async () => {
    db.getBranch.mockResolvedValue(null);
    await expect(BranchPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("BrokerPage", () => {
  const params = Promise.resolve({ locale: "en", id: "a1" });

  it("shows contact buttons and listings to a visitor", async () => {
    db.getBroker.mockResolvedValue({ ...broker, listings: fixtureListings });
    render(await BrokerPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nino");
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+995555000000");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/995555000000");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(fixtureListings.length);
    expect(db.getFavoriteIds).not.toHaveBeenCalled();
  });

  it("marks favourites for a signed-in user", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    db.getFavoriteIds.mockResolvedValue([fixtureListings[0].id]);
    db.getBroker.mockResolvedValue({ ...broker, listings: fixtureListings });
    render(await BrokerPage({ params }));
    expect(screen.getAllByRole("button", { name: t.favorites.remove })).toHaveLength(1);
  });

  it("handles a broker with nothing published", async () => {
    db.getBroker.mockResolvedValue({ ...broker, listings: [] });
    render(await BrokerPage({ params }));
    expect(screen.getByText(t.search.empty)).toBeInTheDocument();
  });

  it("is a 404 for an unknown broker", async () => {
    db.getBroker.mockResolvedValue(null);
    await expect(BrokerPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
