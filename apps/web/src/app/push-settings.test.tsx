import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({
  PREFERENCE_KEYS: ["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates", "notifyPush", "hidePhoneDefault"] as const,
  getPreferences: vi.fn(),
  listDevices: vi.fn(),
  listPushEndpoints: vi.fn(),
  setPreference: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), sessionToken: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import SettingsPage from "./[locale]/(account)/account/settings/page";
import { PushDevice } from "@/components/PushDevice";

const copy = getDictionary("en").push;
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/mine";
const json = { endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } };
const stubKeys = () => {
  vi.stubEnv("VAPID_PUBLIC_KEY", "AQI-_w");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:team@example.test");
};

describe("settings page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    session.currentUser.mockResolvedValue({ id: "u1", role: "USER" });
    session.sessionToken.mockResolvedValue("tok");
    db.getPreferences.mockResolvedValue({ notifyMessages: true, notifySavedSearches: true, notifyPriceDrops: true, notifyListingUpdates: true, notifyPush: true, hidePhoneDefault: false });
    db.listDevices.mockResolvedValue([]);
    db.listPushEndpoints.mockResolvedValue([ENDPOINT]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("leaves push out while the site has no VAPID keys", async () => {
    render(await SettingsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.queryByRole("region", { name: copy.heading })).toBeNull();
    expect(db.listPushEndpoints).not.toHaveBeenCalled();
  });

  it("offers this device and the switch for all devices once the keys are set", async () => {
    stubKeys();
    render(await SettingsPage({ params: Promise.resolve({ locale: "en" }) }));
    const push = within(screen.getByRole("region", { name: copy.heading }));
    expect(push.getByText(copy.intro)).toBeInTheDocument();
    expect(push.getByRole("switch", { name: new RegExp(copy.allDevices) })).toBeChecked();
    // A test browser has no service workers.
    expect(await push.findByText(copy.unsupported)).toBeInTheDocument();
    expect(db.listPushEndpoints).toHaveBeenCalledWith("u1");
  });
});

describe("PushDevice", () => {
  const permission = { value: "default" as NotificationPermission };
  const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
  const unsubscribe = vi.fn(async () => true);
  const siteKey = new Uint8Array([1, 2, 62, 255]).buffer;
  const subscription = { endpoint: ENDPOINT, options: { applicationServerKey: siteKey as ArrayBuffer | null }, toJSON: () => json, unsubscribe };
  const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
  const serviceWorker = { getRegistration: vi.fn(), register: vi.fn(), ready: Promise.resolve({ pushManager }) };
  const fetchMock = vi.fn();

  const show = (endpoints = [ENDPOINT], locale: "en" | "ka" = "en") => render(<PushDevice publicKey="AQI-_w" locale={locale} endpoints={endpoints} copy={copy} />);
  const setAgent = (agent: string, touchPoints = 0) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent);
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: touchPoints });
  };

  beforeEach(() => {
    vi.resetAllMocks();
    permission.value = "default";
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", {
      get permission() {
        return permission.value;
      },
      requestPermission,
    });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    serviceWorker.getRegistration.mockResolvedValue({ pushManager });
    pushManager.getSubscription.mockResolvedValue(null);
    pushManager.subscribe.mockResolvedValue(subscription);
    unsubscribe.mockResolvedValue(true);
    subscription.options.applicationServerKey = siteKey;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "serviceWorker");
    Reflect.deleteProperty(navigator, "maxTouchPoints");
    Reflect.deleteProperty(navigator, "standalone");
  });

  it("says when the browser cannot do push", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    show();
    expect(await screen.findByText(copy.unsupported)).toBeInTheDocument();
  });

  it.each([
    ["an iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1", 5],
    ["an iPad, which says it is a Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5],
  ])("on %s in the browser, explains adding the site to the home screen first", async (_name, agent, touchPoints) => {
    setAgent(agent, touchPoints);
    show();
    expect(await screen.findByText(copy.install)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(copy.installSteps);
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled();
  });

  it("treats a Mac without a touch screen as a desktop browser", async () => {
    setAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15");
    show();
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
  });

  it("offers push on an iPhone once the site is opened from the home screen", async () => {
    setAgent("Mozilla/5.0 (iPhone)", 5);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    show();
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
  });

  it("knows an installed app by its display mode too", async () => {
    setAgent("Mozilla/5.0 (iPhone)", 5);
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    show();
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
  });

  it("says when notifications are blocked in the browser", async () => {
    permission.value = "denied";
    show();
    expect(await screen.findByText(copy.blocked)).toBeInTheDocument();
  });

  it("shows on for a browser subscribed for this user, and turns it off", async () => {
    permission.value = "granted";
    pushManager.getSubscription.mockResolvedValue(subscription);
    show();
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOff }));
    expect(fetchMock).toHaveBeenCalledWith("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: ENDPOINT }) });
    expect(unsubscribe).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("turns off quietly when the subscription is already gone", async () => {
    permission.value = "granted";
    pushManager.getSubscription.mockResolvedValueOnce(subscription).mockResolvedValue(null);
    show();
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOff }));
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["someone else turned it on in this browser", "granted", [] as string[]],
    ["permission was not given yet", "default", [ENDPOINT]],
  ])("shows off when %s", async (_name, given, endpoints) => {
    permission.value = given as NotificationPermission;
    pushManager.getSubscription.mockResolvedValue(subscription);
    show(endpoints);
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
  });

  it.each([
    ["an earlier key pair", new Uint8Array([9, 9]).buffer],
    ["no key", null],
  ])("shows off for a subscription made with %s, and replaces it when turned on", async (_name, key) => {
    permission.value = "granted";
    requestPermission.mockResolvedValue("granted");
    subscription.options.applicationServerKey = key;
    pushManager.getSubscription.mockResolvedValue(subscription);
    show();
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOn }));
    expect(await screen.findByText(copy.on)).toBeInTheDocument();
    expect(unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("shows off when no worker is registered yet", async () => {
    serviceWorker.getRegistration.mockResolvedValue(undefined);
    show();
    expect(await screen.findByRole("button", { name: copy.turnOn })).toBeInTheDocument();
  });

  it("asks permission only on a tap, then subscribes with the site's key and saves it in the page's language", async () => {
    requestPermission.mockResolvedValue("granted");
    show([], "ka");
    const turnOn = await screen.findByRole("button", { name: copy.turnOn });
    expect(requestPermission).not.toHaveBeenCalled();
    await userEvent.click(turnOn);
    expect(await screen.findByText(copy.on)).toBeInTheDocument();
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    const [{ userVisibleOnly, applicationServerKey }] = pushManager.subscribe.mock.calls[0];
    expect(userVisibleOnly).toBe(true);
    expect([...applicationServerKey]).toEqual([1, 2, 62, 255]);
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...json, locale: "ka" }) });
  });

  it("reuses the browser's subscription when there is one", async () => {
    requestPermission.mockResolvedValue("granted");
    pushManager.getSubscription.mockResolvedValue(subscription);
    show([]);
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOn }));
    expect(await screen.findByText(copy.on)).toBeInTheDocument();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it.each([
    ["blocks", "denied", copy.blocked],
    ["dismisses", "default", copy.turnOn],
  ])("stays off when the user %s the question", async (_name, answer, shown) => {
    requestPermission.mockResolvedValue(answer as NotificationPermission);
    show();
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOn }));
    expect(await screen.findByText(shown)).toBeInTheDocument();
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it("says so when saving fails, and lets the user try again", async () => {
    requestPermission.mockResolvedValue("granted");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    show();
    await userEvent.click(await screen.findByRole("button", { name: copy.turnOn }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.failed);
    await waitFor(() => expect(screen.getByRole("button", { name: copy.turnOn })).toBeEnabled());
  });

  it("counts a browser that fails to answer as unsupported", async () => {
    serviceWorker.getRegistration.mockRejectedValue(new Error("SecurityError"));
    show();
    expect(await screen.findByText(copy.unsupported)).toBeInTheDocument();
  });
});
