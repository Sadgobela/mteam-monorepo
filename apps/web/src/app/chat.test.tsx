import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({
  countSellerListings: vi.fn(),
  getConversation: vi.fn(),
  getFavoriteIds: vi.fn(),
  getHiddenIds: vi.fn(),
  getListing: vi.fn(),
  listConversations: vi.fn(),
  listSimilarListings: vi.fn(),
  parseListingId: vi.fn(),
  sendMessage: vi.fn(),
  startConversation: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/account-actions", () => ({ setFavoriteAction: vi.fn(), setHiddenAction: vi.fn() }));
vi.mock("@/lib/report-actions", () => ({ reportListingAction: vi.fn() }));
vi.mock("@/lib/lead-actions", () => ({ leadAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { LiveRefresh } from "@/components/ChatForm";
import { sendChatAction, startChatAction } from "@/lib/chat-actions";
import ListingPage from "./[locale]/listings/[id]/page";
import ConversationPage from "./[locale]/messages/[id]/page";
import MessagesPage from "./[locale]/messages/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });
const threadParams = Promise.resolve({ locale: "en", id: "c1" });
const none = Promise.resolve({});
const [listing] = fixtureListings;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  data.set("locale", "en");
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  db.parseListingId.mockImplementation((raw: string) => (raw === "7" ? 7 : null));
});

describe("listing page", () => {
  const open = async (query: Record<string, string> = {}) => render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "1" }), searchParams: Promise.resolve(query) }));

  beforeEach(() => {
    db.getListing.mockResolvedValue({ ...listing, sellerId: "seller" });
    db.getFavoriteIds.mockResolvedValue([]);
    db.getHiddenIds.mockResolvedValue([]);
    db.listSimilarListings.mockResolvedValue([]);
    db.countSellerListings.mockResolvedValue(1);
  });

  it("lets a signed-in buyer write, and says when it failed", async () => {
    await open({ chat: "failed" });
    expect(screen.getByRole("textbox", { name: t.chat.write })).toBeInTheDocument();
    expect(screen.getByText(t.chat.failed)).toBeInTheDocument();
  });

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await open();
    expect(screen.getByRole("link", { name: t.chat.signIn })).toHaveAttribute("href", "/en/login");
  });

  it("offers nothing on someone's own listing", async () => {
    session.currentUser.mockResolvedValue({ id: "seller" });
    await open();
    expect(screen.queryByRole("textbox", { name: t.chat.write })).toBeNull();
    expect(screen.queryByRole("link", { name: t.chat.signIn })).toBeNull();
  });
});

describe("MessagesPage", () => {
  it("sends visitors to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(MessagesPage({ params })).rejects.toThrow("REDIRECT /en/login");
  });

  it("explains an empty list", async () => {
    db.listConversations.mockResolvedValue([]);
    render(await MessagesPage({ params }));
    expect(screen.getByText(t.chat.empty)).toBeInTheDocument();
  });

  it("links each chat and marks what is unread", async () => {
    db.listConversations.mockResolvedValue([
      { id: "c1", listingId: 7, listingTitle: "Flat", otherName: "Nino", lastBody: "hi", lastAt: new Date(), unread: true },
      { id: "c2", listingId: 8, listingTitle: "House", otherName: null, lastBody: "yo", lastAt: new Date(), unread: false },
    ]);
    render(await MessagesPage({ params }));
    expect(screen.getByRole("link", { name: /Nino · Flat/ })).toHaveAttribute("href", "/en/messages/c1");
    expect(screen.getByRole("link", { name: /User · House/ })).toBeInTheDocument();
    expect(screen.getAllByText(t.chat.unread)).toHaveLength(1);
  });
});

describe("ConversationPage", () => {
  const chat = (otherName: string | null) => ({
    id: "c1",
    listingId: 7,
    listingTitle: "Flat",
    otherName,
    messages: [
      { id: "m1", body: "hello", mine: true, at: new Date("2026-11-01T10:00:00Z") },
      { id: "m2", body: "hi there", mine: false, at: new Date("2026-11-01T11:00:00Z") },
    ],
  });

  it("sends visitors to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(ConversationPage({ params: threadParams, searchParams: none })).rejects.toThrow("REDIRECT /en/login");
  });

  it("is not found for anyone outside the chat", async () => {
    db.getConversation.mockResolvedValue(null);
    await expect(ConversationPage({ params: threadParams, searchParams: none })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the messages, whose they are, and a box to answer", async () => {
    db.getConversation.mockResolvedValue(chat("Nino"));
    const { container } = render(await ConversationPage({ params: threadParams, searchParams: none }));
    expect(screen.getByRole("heading", { level: 1, name: "Nino" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Flat" })).toHaveAttribute("href", "/en/listings/7");
    const bubbles = container.querySelectorAll(".chat-thread li");
    expect(bubbles[0]).toHaveAttribute("data-mine");
    expect(bubbles[1]).not.toHaveAttribute("data-mine");
    expect(screen.queryByText(t.chat.failed)).toBeNull();
    expect(screen.getByRole("textbox", { name: t.chat.message })).toBeInTheDocument();
  });

  it("names an unnamed person, and says when sending failed", async () => {
    db.getConversation.mockResolvedValue(chat(null));
    render(await ConversationPage({ params: threadParams, searchParams: Promise.resolve({ failed: "1" }) }));
    expect(screen.getByRole("heading", { level: 1, name: t.chat.someone })).toBeInTheDocument();
    expect(screen.getByText(t.chat.failed)).toBeInTheDocument();
  });
});

describe("LiveRefresh", () => {
  afterEach(() => vi.useRealTimers());

  it("re-reads the page until it is left", () => {
    vi.useFakeTimers();
    const { unmount } = render(<LiveRefresh />);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("chat actions", () => {
  it("need a signed-in user", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(startChatAction(form({ listingId: "7", body: "hi" }))).rejects.toThrow("REDIRECT /en/login");
    await expect(sendChatAction(form({ conversationId: "c1", body: "hi" }))).rejects.toThrow("REDIRECT /en/login");
    expect(db.startConversation).not.toHaveBeenCalled();
    expect(db.sendMessage).not.toHaveBeenCalled();
  });

  it("open a chat and go to it", async () => {
    db.startConversation.mockResolvedValue("c1");
    await expect(startChatAction(form({ listingId: "7", body: " hi " }))).rejects.toThrow("REDIRECT /en/messages/c1");
    expect(db.startConversation).toHaveBeenCalledWith("u1", 7, "hi");
  });

  it("go back to the listing when a chat cannot be opened", async () => {
    db.startConversation.mockResolvedValue(null);
    await expect(startChatAction(form({ listingId: "7", body: "hi" }))).rejects.toThrow("REDIRECT /en/listings/7?chat=failed");
    await expect(startChatAction(form({ listingId: "7", body: "  " }))).rejects.toThrow("REDIRECT /en/listings/7?chat=failed");
    expect(db.startConversation).toHaveBeenCalledTimes(1);
  });

  it("go home for a listing that makes no sense", async () => {
    await expect(startChatAction(form({ listingId: "bad", body: "hi" }))).rejects.toThrow(/REDIRECT \/en$/);
  });

  it("send a message and stay in the chat", async () => {
    db.sendMessage.mockResolvedValue(true);
    await expect(sendChatAction(form({ conversationId: "c1", body: "hi" }))).rejects.toThrow(/REDIRECT \/en\/messages\/c1$/);
    expect(db.sendMessage).toHaveBeenCalledWith("u1", "c1", "hi");
  });

  it("say so when a message cannot be sent", async () => {
    db.sendMessage.mockResolvedValue(false);
    await expect(sendChatAction(form({ conversationId: "c1", body: "hi" }))).rejects.toThrow("?failed=1");
    await expect(sendChatAction(form({ conversationId: "c1", body: "" }))).rejects.toThrow("?failed=1");
    expect(db.sendMessage).toHaveBeenCalledTimes(1);
  });
});
