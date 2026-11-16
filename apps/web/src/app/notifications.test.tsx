import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ countUnreadNotifications: vi.fn(), listNotifications: vi.fn(), markAllNotificationsRead: vi.fn(), openNotification: vi.fn(), openSavedSearch: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), signInHere: async (locale: string) => `/${locale}/login?next=%2F${locale}%2Fhere` }));
const cacheApi = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => cacheApi);
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { Header } from "@/components/Header";
import { NotificationBell } from "@/components/NotificationBell";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/notification-actions";
import NotificationsPage from "./[locale]/(account)/account/notifications/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  data.set("locale", "en");
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const at = new Date("2026-11-15T10:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("bell", () => {
  const bell = () => screen.getByRole("link", { name: /^Notifications/ });

  it("shows the unread count from the header, linking to the notifications page", async () => {
    db.countUnreadNotifications.mockResolvedValue(3);
    render(<Header locale="en" t={t} signedIn />);
    expect(bell()).toHaveAttribute("href", "/en/account/notifications");
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 3 unread"));
    expect(bell()).toHaveTextContent("3");
    expect(db.countUnreadNotifications).toHaveBeenCalledWith("u1");
  });

  it("caps the count at 9+", async () => {
    render(<NotificationBell locale="en" labels={t.notifications} unread={Promise.resolve(12)} />);
    await waitFor(() => expect(bell()).toHaveTextContent("9+"));
    expect(bell()).toHaveAccessibleName("Notifications, 12 unread");
  });

  it("hides the count at zero, for a stale session and when counting fails", async () => {
    session.currentUser.mockResolvedValue(null);
    const { unmount } = render(<Header locale="en" t={t} signedIn />);
    await waitFor(() => expect(session.currentUser).toHaveBeenCalled());
    expect(db.countUnreadNotifications).not.toHaveBeenCalled();
    expect(bell()).toHaveAccessibleName("Notifications");
    expect(bell()).toHaveTextContent("");
    unmount();

    const failing = Promise.reject(new Error("down"));
    render(<NotificationBell locale="en" labels={t.notifications} unread={failing} />);
    await expect(failing).rejects.toThrow("down");
    expect(bell()).toHaveAccessibleName("Notifications");
  });

  it("is not there for visitors", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.queryByRole("link", { name: /^Notifications/ })).toBeNull();
    expect(session.currentUser).not.toHaveBeenCalled();
  });
});

describe("notifications page", () => {
  it("sends visitors to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(NotificationsPage({ params })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fnotifications");
  });

  it("says when there is nothing, without offering to mark anything read", async () => {
    db.listNotifications.mockResolvedValue([]);
    render(await NotificationsPage({ params }));
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText(t.notifications.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.notifications.markAllRead })).toBeNull();
  });

  it("lists each kind with its text and subject, newest first, unread ones marked", async () => {
    const listing = { listingId: 7, listingTitle: "Flat in Vake" };
    db.listNotifications.mockResolvedValue([
      { id: "n1", type: "MESSAGE", ...listing, conversationId: "c1", count: 2, read: false, at },
      { id: "n2", type: "LISTING_APPROVED", ...listing, read: true, at },
      { id: "n3", type: "LISTING_REJECTED", ...listing, read: true, at },
      { id: "n4", type: "LISTING_EXPIRING", ...listing, expiresAt: "2026-11-18T00:00:00.000Z", read: true, at },
      { id: "n5", type: "PRICE_DROP", ...listing, oldPriceUsd: 100000, newPriceUsd: 90000, read: true, at },
      { id: "n6", type: "SEARCH_MATCHES", savedSearchId: "s1", query: "deal=sale", count: 3, read: true, at },
      { id: "n7", type: "SEARCH_MATCHES", savedSearchId: "s2", query: "", count: 1, read: true, at },
    ]);
    render(await NotificationsPage({ params }));
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("button").querySelector(".notice-text")?.textContent)).toEqual([
      "New messages: 2",
      "Your listing is published",
      "Your listing was not approved",
      "Your listing ends on Nov 18. Renew it to keep it on the site.",
      "A favourite got cheaper: $100,000 → $90,000",
      "New listings for your saved search: 3",
      "New listings for your saved search: 1",
    ]);
    expect(items[0]).toHaveTextContent("New");
    expect(items[0].querySelector(".notice")).toHaveClass("unread");
    expect(items[1].querySelector(".notice")).not.toHaveClass("unread");
    expect(items[1]).toHaveTextContent("Flat in Vake");
    expect(items[5]).toHaveTextContent("For sale");
    expect(items[6]).toHaveTextContent("All listings");
    expect(items[0].querySelector('input[name="id"]')).toHaveValue("n1");
    expect(screen.getByRole("button", { name: t.notifications.markAllRead })).toBeInTheDocument();
    expect(db.listNotifications).toHaveBeenCalledWith("u1");
  });
});

describe("notification actions", () => {
  const listing = { listingId: 7, listingTitle: "Flat" };

  it.each([
    [{ type: "MESSAGE", ...listing, conversationId: "c1", count: 1 }, "/en/messages/c1"],
    [{ type: "LISTING_APPROVED", ...listing }, "/en/listings/7"],
    [{ type: "PRICE_DROP", ...listing, oldPriceUsd: 2, newPriceUsd: 1 }, "/en/listings/7"],
    [{ type: "LISTING_REJECTED", ...listing }, "/en/my-listings"],
    [{ type: "LISTING_EXPIRING", ...listing, expiresAt: "2026-11-18T00:00:00.000Z" }, "/en/my-listings"],
  ])("marks one read and follows it", async (notice, to) => {
    db.openNotification.mockResolvedValue(notice);
    await expect(openNotificationAction(form({ id: "n1" }))).rejects.toThrow(`REDIRECT ${to}`);
    expect(db.openNotification).toHaveBeenCalledWith("u1", "n1");
    expect(cacheApi.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("opens a saved search's results, or the list when the search is gone", async () => {
    db.openNotification.mockResolvedValue({ type: "SEARCH_MATCHES", savedSearchId: "s1", query: "deal=sale", count: 2 });
    db.openSavedSearch.mockResolvedValueOnce("deal=sale").mockResolvedValueOnce(null);
    await expect(openNotificationAction(form({ id: "n1" }))).rejects.toThrow("REDIRECT /en?deal=sale");
    expect(db.openSavedSearch).toHaveBeenCalledWith("u1", "s1");
    await expect(openNotificationAction(form({ id: "n1" }))).rejects.toThrow("REDIRECT /en/saved");
  });

  it("leads back to the list for someone else's or a malformed id", async () => {
    db.openNotification.mockResolvedValue(null);
    await expect(openNotificationAction(form({ id: "bad id" }))).rejects.toThrow("REDIRECT /en/account/notifications");
    expect(db.openNotification).toHaveBeenCalledWith("u1", "");
  });

  it("marks all read", async () => {
    await markAllNotificationsReadAction(form({}));
    expect(db.markAllNotificationsRead).toHaveBeenCalledWith("u1");
    expect(cacheApi.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sends visitors to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(markAllNotificationsReadAction(form({}))).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Fhere");
    await expect(openNotificationAction(form({ id: "n1" }))).rejects.toThrow("REDIRECT /en/login");
    expect(db.markAllNotificationsRead).not.toHaveBeenCalled();
    expect(db.openNotification).not.toHaveBeenCalled();
  });
});
