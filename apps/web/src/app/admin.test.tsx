import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({
  listOpenLeads: vi.fn(),
  listOpenReports: vi.fn(async (): Promise<unknown[]> => []),
  resolveReport: vi.fn(),
  listPendingListings: vi.fn(),
  listUnverifiedListings: vi.fn(),
  markLeadContacted: vi.fn(),
  parseListingId: vi.fn(),
  reviewListing: vi.fn(),
  verifyListing: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useSearchParams: () => null,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { markLeadContactedAction, resolveReportAction, reviewListingAction, verifyListingAction } from "@/lib/admin-actions";
import AdminPage from "./[locale]/admin/page";

const t = getDictionary("en");
const admin = { id: "u1", role: "ADMIN", agent: { id: "a1" } };
const broker = { id: "u2", role: "AGENT", agent: { id: "a2" } };
const user = { id: "u3", role: "USER", agent: null };
const params = Promise.resolve({ locale: "en" });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  db.parseListingId.mockReturnValue(7);
  db.listPendingListings.mockResolvedValue([]);
  db.listUnverifiedListings.mockResolvedValue([]);
  db.listOpenLeads.mockResolvedValue([]);
});

describe("reviewListingAction", () => {
  it.each(["ACTIVE", "REJECTED"])("lets an admin set %s", async (decision) => {
    session.currentUser.mockResolvedValue(admin);
    await reviewListingAction(form({ listingId: "7", decision }));
    expect(db.reviewListing).toHaveBeenCalledWith(7, decision);
  });

  it.each([[null], [user], [broker]])("refuses anyone else", async (who) => {
    session.currentUser.mockResolvedValue(who);
    await expect(reviewListingAction(form({ listingId: "7", decision: "ACTIVE" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.reviewListing).not.toHaveBeenCalled();
  });

  it("ignores an unknown decision or id", async () => {
    session.currentUser.mockResolvedValue(admin);
    await reviewListingAction(form({ listingId: "7", decision: "ARCHIVED" }));
    db.parseListingId.mockReturnValue(null);
    await reviewListingAction(form({ listingId: "x", decision: "ACTIVE" }));
    expect(db.reviewListing).not.toHaveBeenCalled();
  });
});

describe("verifyListingAction", () => {
  it("signs the check with the broker's own record", async () => {
    session.currentUser.mockResolvedValue(broker);
    await verifyListingAction(form({ listingId: "7" }));
    expect(db.verifyListing).toHaveBeenCalledWith("a2", 7);
  });

  it("refuses an ordinary user", async () => {
    session.currentUser.mockResolvedValue(user);
    await expect(verifyListingAction(form({ listingId: "7" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.verifyListing).not.toHaveBeenCalled();
  });

  it("does nothing for a bad id or staff with no broker record", async () => {
    session.currentUser.mockResolvedValue({ ...admin, agent: null });
    await verifyListingAction(form({ listingId: "7" }));
    session.currentUser.mockResolvedValue(broker);
    db.parseListingId.mockReturnValue(null);
    await verifyListingAction(form({ listingId: "x" }));
    expect(db.verifyListing).not.toHaveBeenCalled();
  });
});

describe("resolveReportAction", () => {
  it("is not open to brokers", async () => {
    session.currentUser.mockResolvedValue({ id: "b1", role: "AGENT" });
    await expect(resolveReportAction(form({ reportId: "r1" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.resolveReport).not.toHaveBeenCalled();
  });

  it("marks a report done for admins only", async () => {
    session.currentUser.mockResolvedValue(admin);
    await resolveReportAction(form({ reportId: "r1" }));
    expect(db.resolveReport).toHaveBeenCalledWith("r1");
    session.currentUser.mockResolvedValue(null);
    await expect(resolveReportAction(form({ reportId: "r1" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("markLeadContactedAction", () => {
  it("updates a lead for staff", async () => {
    session.currentUser.mockResolvedValue(broker);
    await markLeadContactedAction(form({ leadId: "cm123abc" }));
    expect(db.markLeadContacted).toHaveBeenCalledWith("cm123abc");
  });

  it("ignores a malformed id", async () => {
    session.currentUser.mockResolvedValue(broker);
    await markLeadContactedAction(form({ leadId: "a b" }));
    expect(db.markLeadContacted).not.toHaveBeenCalled();
  });

  it("refuses an ordinary user", async () => {
    session.currentUser.mockResolvedValue(user);
    await expect(markLeadContactedAction(form({ leadId: "x" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("AdminPage", () => {
  const lead = (status: string, deal: string) => ({ id: `l-${status}`, name: `N-${status}`, phone: "+995555", deal, status, createdAt: new Date("2026-11-06T10:00:00Z") });

  it.each([[null], [user]])("is a 404 for non-staff", async (who) => {
    session.currentUser.mockResolvedValue(who);
    await expect(AdminPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.listOpenLeads).not.toHaveBeenCalled();
  });

  it("shows admins every queue", async () => {
    session.currentUser.mockResolvedValue(admin);
    db.listPendingListings.mockResolvedValue([{ ...fixtureListings[0], images: ["https://cdn/a.jpg"] }]);
    db.listUnverifiedListings.mockResolvedValue([fixtureListings[1]]);
    db.listOpenLeads.mockResolvedValue([lead("NEW", "SALE"), lead("CONTACTED", "RENT")]);
    render(await AdminPage({ params }));
    expect(screen.getByRole("button", { name: t.admin.approve })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.admin.reject })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.admin.verify })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: t.admin.contacted })).toHaveLength(1);
    expect(screen.getByText(t.admin.contactedDone)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "+995555" })[0]).toHaveAttribute("href", "tel:+995555");
  });

  it("hides moderation from brokers and does not load it", async () => {
    session.currentUser.mockResolvedValue(broker);
    render(await AdminPage({ params }));
    expect(screen.queryByRole("heading", { name: t.admin.pending })).toBeNull();
    expect(db.listPendingListings).not.toHaveBeenCalled();
  });

  it("lists open reports with their reason and note", async () => {
    session.currentUser.mockResolvedValue(admin);
    const report = { id: "r1", createdAt: new Date("2026-11-10"), listing: { id: 7, title: "Reported flat" } };
    db.listOpenReports.mockResolvedValue([
      { ...report, reason: "fake", note: "Not real" },
      { ...report, id: "r2", reason: "retired", note: null },
    ]);
    render(await AdminPage({ params }));
    expect(screen.getAllByRole("link", { name: "Reported flat" })[0]).toHaveAttribute("href", "/en/listings/7");
    expect(screen.getByText(/Fake listing/)).toBeInTheDocument();
    expect(screen.getByText("Not real")).toBeInTheDocument();
    expect(screen.getByText(/^retired/)).toBeInTheDocument();
  });

  it("says when each queue is empty", async () => {
    session.currentUser.mockResolvedValue(admin);
    render(await AdminPage({ params }));
    expect(screen.getAllByText(t.admin.nothing)).toHaveLength(4);
  });
});
