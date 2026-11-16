import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  PREFERENCE_KEYS: ["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates", "hidePhoneDefault"] as const,
  getPreferences: vi.fn(),
  listDevices: vi.fn(),
  setPreference: vi.fn(),
  signOutDevice: vi.fn(),
  signOutOtherDevices: vi.fn(),
  deleteAccount: vi.fn(),
}));
const session = vi.hoisted(() => ({
  currentUser: vi.fn(),
  sessionToken: vi.fn(),
  endSession: vi.fn(),
  signInHere: async (locale: string) => `/${locale}/login?next=here`,
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import SettingsPage from "./[locale]/(account)/account/settings/page";
import { deleteAccountAction, setPreferenceAction, signOutDeviceAction, signOutOthersAction } from "@/lib/settings-actions";

const params = Promise.resolve({ locale: "en" });
const owner = { id: "u1", role: "USER" };
const deviceId = (n: number) => String(n).repeat(64);
const preferences = { notifyMessages: true, notifySavedSearches: false, notifyPriceDrops: true, notifyListingUpdates: true, hidePhoneDefault: false };
const seen = new Date("2026-11-16T09:00:00Z");
const thisDevice = { id: deviceId(1), userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36", lastSeenAt: seen, current: true };
const others = [
  { id: deviceId(2), userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", lastSeenAt: seen, current: false },
  { id: deviceId(3), userAgent: "Firefox/133.0", lastSeenAt: seen, current: false },
  { id: deviceId(4), userAgent: "Dalvik/2.1.0 (Linux; U; Android 14)", lastSeenAt: seen, current: false },
  { id: deviceId(5), userAgent: null, lastSeenAt: seen, current: false },
];

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  data.set("locale", "en");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue(owner);
  session.sessionToken.mockResolvedValue("tok");
  db.getPreferences.mockResolvedValue(preferences);
  db.listDevices.mockResolvedValue([thisDevice, ...others]);
});

describe("settings page", () => {
  it.each([
    ["no user", null, "tok"],
    ["no session cookie", owner, undefined],
  ])("sends a visitor with %s to sign in", async (_case, user, token) => {
    session.currentUser.mockResolvedValue(user);
    session.sessionToken.mockResolvedValue(token);
    await expect(SettingsPage({ params })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fsettings");
  });

  it("shows the switches as stored, with the note on how notifications arrive", async () => {
    render(await SettingsPage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(db.listDevices).toHaveBeenCalledWith("u1", "tok");
    const notifications = within(screen.getByRole("region", { name: "Notifications" }));
    expect(notifications.getByText(/Email and SMS will follow later/)).toBeInTheDocument();
    expect(notifications.getByRole("switch", { name: "New chat messages" })).toBeChecked();
    expect(notifications.getByRole("switch", { name: "New listings for my saved searches" })).not.toBeChecked();
    expect(notifications.getAllByRole("switch")).toHaveLength(4);
    const privacy = screen.getByRole("switch", { name: /^Hide my number on new listings/ });
    expect(privacy).not.toBeChecked();
    expect(privacy).toHaveAccessibleDescription("Buyers then write to you in chat instead of calling.");
  });

  it("names each device in plain words, marks this one, and offers to sign out the others", async () => {
    render(await SettingsPage({ params }));
    const devices = within(screen.getByRole("region", { name: "Signed-in devices" }));
    const rows = devices.getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("b")?.textContent)).toEqual(["Chrome on Mac", "Safari on iPhone", "Firefox", "Android", "Unknown device"]);
    expect(rows[0]).toHaveTextContent("This device");
    expect(rows[0]).toHaveTextContent(/Last active/);
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(within(rows[1]).getByRole("button", { name: "Sign out" }).closest("form")?.querySelector("input[name=id]")).toHaveValue(deviceId(2));
    expect(devices.getAllByRole("button", { name: "Sign out" })).toHaveLength(4);
    expect(devices.getByRole("button", { name: "Sign out all other devices" })).toBeInTheDocument();
  });

  it("has nothing to sign out when this is the only device", async () => {
    db.listDevices.mockResolvedValue([thisDevice]);
    render(await SettingsPage({ params }));
    expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull();
  });

  it("says what deleting does before asking, and asks once more", async () => {
    render(await SettingsPage({ params }));
    const remove = within(screen.getByRole("region", { name: "Delete my account" }));
    expect(remove.getByText("Your listings are taken off the site.")).toBeInTheDocument();
    expect(remove.getByText("This cannot be undone.")).toBeInTheDocument();
    await userEvent.click(remove.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByText("Delete your account for good?")).toBeInTheDocument();
    expect(document.querySelector("button[name=confirm]")).toHaveValue("yes");
  });

  it.each(["AGENT", "ADMIN"])("tells a user with role %s to ask an admin instead", async (role) => {
    session.currentUser.mockResolvedValue({ id: "s1", role });
    render(await SettingsPage({ params }));
    const remove = within(screen.getByRole("region", { name: "Delete my account" }));
    expect(remove.getByText(/Please ask an admin/)).toBeInTheDocument();
    expect(remove.queryByRole("button")).toBeNull();
  });
});

describe("preference switch", () => {
  it("saves a flip straight away", async () => {
    render(<App>{await SettingsPage({ params })}</App>);
    const messages = screen.getByRole("switch", { name: "New chat messages" });
    await userEvent.click(messages);
    await waitFor(() => expect(db.setPreference).toHaveBeenCalledWith("u1", "notifyMessages", false));
    expect(messages).not.toBeChecked();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("That could not be saved. Please try again.")).toBeNull();
  });

  it("flips back and says so when it could not be saved", async () => {
    render(await SettingsPage({ params }));
    session.currentUser.mockResolvedValue(null);
    const hide = screen.getByRole("switch", { name: /^Hide my number/ });
    await userEvent.click(hide);
    expect(await screen.findByRole("alert")).toHaveTextContent("That could not be saved. Please try again.");
    expect(hide).not.toBeChecked();
    expect(db.setPreference).not.toHaveBeenCalled();
  });

  it("flips back when saving throws, instead of crashing", async () => {
    render(await SettingsPage({ params }));
    db.setPreference.mockRejectedValueOnce(new Error("gone"));
    const messages = screen.getByRole("switch", { name: "New chat messages" });
    await userEvent.click(messages);
    expect(await screen.findByRole("alert")).toHaveTextContent("That could not be saved. Please try again.");
    expect(messages).toBeChecked();
  });
});

describe("setPreferenceAction", () => {
  it.each([
    ["an unknown setting", "role", true],
    ["a value that is not on or off", "notifyMessages", "yes"],
  ])("refuses %s", async (_case, key, value) => {
    expect(await setPreferenceAction(key, value)).toBe(false);
    expect(db.setPreference).not.toHaveBeenCalled();
  });

  it("saves for the signed-in user only", async () => {
    expect(await setPreferenceAction("hidePhoneDefault", true)).toBe(true);
    expect(db.setPreference).toHaveBeenCalledWith("u1", "hidePhoneDefault", true);
  });
});

describe("signing devices out", () => {
  it("signs out one of the user's devices, keeping this one", async () => {
    await signOutDeviceAction(form({ id: deviceId(2) }));
    expect(db.signOutDevice).toHaveBeenCalledWith("u1", deviceId(2), "tok");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/en/account/settings");
  });

  it("ignores an id that is not a session's", async () => {
    await signOutDeviceAction(form({ id: "'; DROP TABLE" }));
    expect(db.signOutDevice).not.toHaveBeenCalled();
  });

  it("signs out every other device", async () => {
    await signOutOthersAction(form({}));
    expect(db.signOutOtherDevices).toHaveBeenCalledWith("u1", "tok");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/en/account/settings");
  });

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(signOutOthersAction(form({}))).rejects.toThrow("REDIRECT /en/login?next=here");
    expect(db.signOutOtherDevices).not.toHaveBeenCalled();
  });
});

describe("deleteAccountAction", () => {
  it("deletes, signs this browser out and goes home", async () => {
    db.deleteAccount.mockResolvedValue(true);
    await expect(deleteAccountAction(form({ confirm: "yes" }))).rejects.toThrow("REDIRECT /en");
    expect(db.deleteAccount).toHaveBeenCalledWith("u1");
    expect(session.endSession).toHaveBeenCalled();
  });

  it("does nothing without the confirmation", async () => {
    await expect(deleteAccountAction(form({}))).rejects.toThrow("REDIRECT /en/account/settings");
    expect(db.deleteAccount).not.toHaveBeenCalled();
  });

  it.each(["AGENT", "ADMIN"])("refuses a user with role %s", async (role) => {
    session.currentUser.mockResolvedValue({ id: "s1", role });
    await expect(deleteAccountAction(form({ confirm: "yes" }))).rejects.toThrow("REDIRECT /en/account/settings");
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(session.endSession).not.toHaveBeenCalled();
  });

  it("keeps the session when the database refuses, as for someone promoted a moment ago", async () => {
    db.deleteAccount.mockResolvedValue(false);
    await expect(deleteAccountAction(form({ confirm: "yes" }))).rejects.toThrow("REDIRECT /en/account/settings");
    expect(session.endSession).not.toHaveBeenCalled();
  });
});
