import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({
  checkInvite: vi.fn(),
  claimInviteCheck: vi.fn(),
  getBrokerProfile: vi.fn(),
  listCurrentBrokers: vi.fn(),
  listInviteBranches: vi.fn(),
  listInvites: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn(async () => true), clientIp: vi.fn(async () => "1.2.3.4") }));
const actions = vi.hoisted(() => ({
  acceptInviteAction: vi.fn(),
  createInviteAction: vi.fn(),
  removeBrokerAction: vi.fn(),
  requestVerifyAction: vi.fn(),
  revokeInviteAction: vi.fn(),
  saveBrokerProfileAction: vi.fn(),
}));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/invite-actions", () => actions);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/account/broker",
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import AccountLayout from "./[locale]/(account)/layout";
import BrokerProfilePage from "./[locale]/(account)/account/broker/page";
import AdminBrokersPage from "./[locale]/admin/brokers/page";
import InvitePage from "./[locale]/invite/[token]/page";
import { VerifyRequest } from "@/components/VerifyRequest";

const t = getDictionary("en");
const copy = t.brokersAdmin;
const admin = { id: "u1", role: "ADMIN", agent: { id: "a1" }, name: "Admin", phone: "+995555000001" };
const broker = { id: "u2", role: "AGENT", agent: { id: "a2" }, name: "Nino", phone: "+995555000002" };
const owner = { id: "u3", role: "USER", agent: null, name: null, phone: "+995555000003" };
const params = Promise.resolve({ locale: "en" });
const token = "t".repeat(43);
const day = 24 * 60 * 60_000;

beforeEach(() => {
  vi.clearAllMocks();
  session.currentUser.mockResolvedValue(null);
});

describe("AdminBrokersPage", () => {
  it.each([null, broker, owner])("is a 404 for anyone but an admin (%o)", async (user) => {
    session.currentUser.mockResolvedValue(user);
    await expect(AdminBrokersPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists invites by status and brokers, with a way to revoke and to remove", async () => {
    session.currentUser.mockResolvedValue(admin);
    const created = new Date("2026-11-10T10:00:00Z");
    const expires = new Date(created.getTime() + 7 * day);
    db.listInviteBranches.mockResolvedValue([{ id: "b1", name: "Vake" }]);
    db.listInvites.mockResolvedValue([
      { id: "h1", branch: "Vake", status: "open", createdAt: created, expiresAt: expires, usedAt: null, usedBy: null },
      { id: "h2", branch: "", status: "used", createdAt: created, expiresAt: expires, usedAt: created, usedBy: "Nino" },
      { id: "h3", branch: "", status: "used", createdAt: created, expiresAt: expires, usedAt: created, usedBy: null },
      { id: "h4", branch: "", status: "expired", createdAt: created, expiresAt: expires, usedAt: null, usedBy: null },
    ]);
    db.listCurrentBrokers.mockResolvedValue([
      { userId: "u2", name: "Nino", phone: "+995555000002", branch: "Vake" },
      { userId: "u4", name: "", phone: "", branch: "" },
    ]);
    render(await AdminBrokersPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.heading);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getAllByText("Used")).toHaveLength(2);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/Vake · Valid until/)).toBeInTheDocument();
    expect(screen.getByText(/Used by Nino/)).toBeInTheDocument();
    expect(screen.getByText(/Used by No name/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: copy.revoke })).toHaveLength(1);
    expect(screen.getByText("+995555000002 · Vake")).toBeInTheDocument();
    expect(screen.getByText(copy.noName)).toBeInTheDocument();
    expect(screen.getByText(copy.noBranch)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: copy.remove })).toHaveLength(2);
  });

  it("says when there is nothing yet", async () => {
    session.currentUser.mockResolvedValue(admin);
    db.listInviteBranches.mockResolvedValue([]);
    db.listInvites.mockResolvedValue([]);
    db.listCurrentBrokers.mockResolvedValue([]);
    render(await AdminBrokersPage({ params }));
    expect(screen.getAllByText(t.admin.nothing)).toHaveLength(2);
  });
});

describe("InviteCreator", () => {
  const open = async () => {
    session.currentUser.mockResolvedValue(admin);
    db.listInviteBranches.mockResolvedValue([{ id: "b1", name: "Vake" }]);
    db.listInvites.mockResolvedValue([]);
    db.listCurrentBrokers.mockResolvedValue([]);
    render(await AdminBrokersPage({ params }));
  };

  it("shows a new link once, with a copy button", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    actions.createInviteAction.mockResolvedValue({ link: `http://localhost:3111/en/invite/${token}` });
    await open();
    await user.click(screen.getByRole("button", { name: copy.create }));
    expect(await screen.findByRole("status")).toHaveTextContent(copy.created);
    const field = screen.getByRole("textbox", { name: copy.inviteHeading });
    expect(field).toHaveValue(`http://localhost:3111/en/invite/${token}`);
    await user.click(field);
    await user.click(screen.getByRole("button", { name: copy.copy }));
    expect(writeText).toHaveBeenCalledWith(`http://localhost:3111/en/invite/${token}`);
    expect(screen.getByRole("button", { name: copy.copied })).toBeInTheDocument();
  });

  it("says when the link could not be made", async () => {
    const user = userEvent.setup();
    actions.createInviteAction.mockResolvedValue({ failed: true });
    await open();
    await user.click(screen.getByRole("button", { name: copy.create }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.failed);
  });
});

describe("InvitePage", () => {
  const visit = async () => render(await InvitePage({ params: Promise.resolve({ locale: "en", token }) }));

  it("asks a visitor to sign in and come back, without checking the link", async () => {
    await visit();
    expect(within(screen.getByRole("main")).getByRole("link", { name: copy.signIn })).toHaveAttribute("href", `/en/login?next=${encodeURIComponent(`/en/invite/${token}`)}`);
    expect(db.claimInviteCheck).not.toHaveBeenCalled();
  });

  it.each([broker, admin])("tells a broker or admin they already are one (%o)", async (user) => {
    session.currentUser.mockResolvedValue(user);
    await visit();
    expect(screen.getByText(copy.already)).toBeInTheDocument();
    expect(db.checkInvite).not.toHaveBeenCalled();
  });

  it("stops checking links past the limit", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(false);
    await visit();
    expect(screen.getByRole("alert")).toHaveTextContent(copy.tooMany);
    expect(db.checkInvite).not.toHaveBeenCalled();
  });

  it.each(["missing", "used", "expired"] as const)("says plainly when the link is %s", async (status) => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(true);
    db.checkInvite.mockResolvedValue({ status, branch: "" });
    await visit();
    expect(screen.getByRole("alert")).toHaveTextContent(copy[status]);
    expect(screen.queryByRole("button", { name: copy.accept })).toBeNull();
  });

  it("explains what accepting means, with the branch when there is one", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(true);
    db.checkInvite.mockResolvedValue({ status: "open", branch: "Vake" });
    const { unmount } = await visit();
    expect(db.claimInviteCheck).toHaveBeenCalledWith("1.2.3.4");
    expect(db.checkInvite).toHaveBeenCalledWith(token);
    expect(screen.getByText(copy.explain)).toBeInTheDocument();
    expect(screen.getByText("Branch: Vake")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.accept })).toBeInTheDocument();
    unmount();
    db.checkInvite.mockResolvedValue({ status: "open", branch: "" });
    await visit();
    expect(screen.queryByText(/Branch:/)).toBeNull();
  });
});

describe("BrokerProfilePage", () => {
  const profile = { photoUrl: "https://img.example/nino.jpg", bio: "Ten years in Vake.", branch: "Vake" };

  it("sends a visitor to sign in", async () => {
    await expect(BrokerProfilePage({ params })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fbroker");
  });

  it("is a 404 for anyone who is not a broker", async () => {
    for (const user of [owner, admin, { ...broker, agent: null }]) {
      session.currentUser.mockResolvedValue(user);
      await expect(BrokerProfilePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    session.currentUser.mockResolvedValue(broker);
    db.getBrokerProfile.mockResolvedValue(null);
    await expect(BrokerProfilePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the photo, the bio and the branch, and links the public page", async () => {
    session.currentUser.mockResolvedValue(broker);
    db.getBrokerProfile.mockResolvedValue(profile);
    const { container } = render(await BrokerProfilePage({ params }));
    expect(db.getBrokerProfile).toHaveBeenCalledWith("a2");
    expect(container.querySelector(".broker-photo img")).toHaveAttribute("src", profile.photoUrl);
    expect(screen.getByRole("textbox", { name: new RegExp(copy.bio) })).toHaveValue(profile.bio);
    expect(screen.getByText("Vake")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.publicPage })).toHaveAttribute("href", "/en/brokers/a2");
  });

  it("works for a broker with nothing filled in, who has no public page yet", async () => {
    session.currentUser.mockResolvedValue({ ...broker, name: null });
    db.getBrokerProfile.mockResolvedValue({ photoUrl: null, bio: null, branch: "" });
    const { container } = render(await BrokerProfilePage({ params }));
    expect(container.querySelector(".broker-photo img")).toBeNull();
    expect(screen.getByRole("textbox", { name: new RegExp(copy.bio) })).toHaveValue("");
    expect(screen.getByText(copy.noBranch)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.publicPage })).toBeNull();
  });

  it.each([
    [{ saved: true }, "status", copy.saved],
    [{ badPhoto: true }, "alert", copy.badPhoto],
    [{ badBio: true }, "alert", copy.badBio],
    [{ failed: true }, "alert", copy.saveFailed],
  ] as const)("tells the broker how saving went (%o)", async (result, role, text) => {
    const user = userEvent.setup();
    session.currentUser.mockResolvedValue(broker);
    db.getBrokerProfile.mockResolvedValue(profile);
    actions.saveBrokerProfileAction.mockResolvedValue(result);
    render(await BrokerProfilePage({ params }));
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(await screen.findByRole(role)).toHaveTextContent(text);
  });
});

describe("BrokerProfileForm sending", () => {
  it("says so when the request itself fails, instead of breaking the page", async () => {
    const user = userEvent.setup();
    session.currentUser.mockResolvedValue(broker);
    db.getBrokerProfile.mockResolvedValue({ photoUrl: null, bio: null, branch: "" });
    actions.saveBrokerProfileAction.mockRejectedValue(new Error("Body exceeded 4mb limit"));
    render(await BrokerProfilePage({ params }));
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.saveFailed);
    expect(actions.saveBrokerProfileAction).toHaveBeenCalledOnce();
  });
});

describe("account navigation for brokers", () => {
  it("adds the broker profile for a broker only", async () => {
    session.currentUser.mockResolvedValue(broker);
    const { unmount } = render(await AccountLayout({ children: null, params }));
    expect(screen.getByRole("link", { name: copy.profile })).toHaveAttribute("aria-current", "page");
    unmount();
    session.currentUser.mockResolvedValue(owner);
    render(await AccountLayout({ children: null, params }));
    expect(screen.queryByRole("link", { name: copy.profile })).toBeNull();
  });
});

describe("VerifyRequest", () => {
  it("files the request in one click and says a broker will be in touch", async () => {
    const user = userEvent.setup();
    actions.requestVerifyAction.mockResolvedValue({ sent: true });
    render(<VerifyRequest listingId={7} locale="en" t={t} hasPhone />);
    expect(screen.getByText(copy.verifyLead)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy.verifyAsk }));
    expect(await screen.findByRole("status")).toHaveTextContent(copy.verifySent);
    const sent = actions.requestVerifyAction.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(sent)).toEqual({ locale: "en", listingId: "7" });
  });

  it("asks an owner without a phone to add one first, since the broker calls", () => {
    render(<VerifyRequest listingId={7} locale="en" t={t} hasPhone={false} />);
    expect(screen.getByText(copy.verifyNeedsPhone)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.openProfile })).toHaveAttribute("href", "/en/account/profile");
    expect(screen.queryByRole("button", { name: copy.verifyAsk })).toBeNull();
  });

  it("says when it could not be sent", async () => {
    const user = userEvent.setup();
    actions.requestVerifyAction.mockResolvedValue({ failed: true });
    render(<VerifyRequest listingId={7} locale="en" t={t} hasPhone />);
    await user.click(screen.getByRole("button", { name: copy.verifyAsk }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.verifyFailed);
  });
});
