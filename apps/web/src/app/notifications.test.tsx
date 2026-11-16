import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ countUnreadNotifications: vi.fn() }));
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

const t = getDictionary("en");

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
