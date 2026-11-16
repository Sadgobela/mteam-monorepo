import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";

const path = vi.hoisted(() => ({ current: "/en/saved" as string | null }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn(async () => true) }));

vi.mock("next/navigation", () => ({
  usePathname: () => path.current,
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

import AccountLayout from "./[locale]/(account)/layout";
import ProfilePage from "./[locale]/(account)/account/profile/page";
import SettingsPage from "./[locale]/(account)/account/settings/page";
import NotificationsPage from "./[locale]/(account)/account/notifications/page";
import { AccountNav } from "@/components/AccountNav";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });

describe("account shell", () => {
  it("puts the account's pages next to the page, with the header", async () => {
    render(await AccountLayout({ children: <main>inside</main>, params }));
    const nav = screen.getByRole("navigation", { name: "Account" });
    expect(nav).toHaveTextContent("My listings");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/en/account/profile");
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("marks the open page, its subpages too, and nothing when the path is unknown", () => {
    const { rerender } = render(<AccountNav locale="en" t={t} />);
    expect(screen.getByRole("link", { name: "Saved searches" })).toHaveAttribute("aria-current", "page");
    path.current = "/en/messages/abc";
    rerender(<AccountNav locale="en" t={t} />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("aria-current", "page");
    path.current = null;
    rerender(<AccountNav locale="en" t={t} />);
    expect(screen.queryByRole("link", { current: "page" })).toBeNull();
  });

  it.each([
    ["profile", ProfilePage, "Profile"],
    ["settings", SettingsPage, "Settings"],
    ["notifications", NotificationsPage, "Notifications"],
  ] as const)("shows the %s placeholder to a signed-in user and sends others to sign in", async (name, Page, heading) => {
    session.currentUser.mockResolvedValueOnce({ id: "u1" });
    render(await Page({ params }));
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    session.currentUser.mockResolvedValueOnce(null);
    await expect(Page({ params })).rejects.toThrow(`REDIRECT /en/login?next=%2Fen%2Faccount%2F${name}`);
  });
});
