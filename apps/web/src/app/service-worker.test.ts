// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "./manifest";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://mteam.test";

interface Tab {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

/** Runs public/sw.js against a stand-in for the worker's global scope, and fires its events. */
function worker(tabs: Tab[] = []) {
  const handlers = new Map<string, (event: object) => void>();
  const scope = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: object) => void) => handlers.set(type, handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => tabs), openWindow: vi.fn(async () => null) },
    registration: { showNotification: vi.fn<(title: string, options: object) => Promise<void>>(async () => undefined) },
  };
  new Function("self", source)(scope);
  const fire = async (type: string, event: object) => {
    const waits: Promise<unknown>[] = [];
    handlers.get(type)?.({ ...event, waitUntil: (work: Promise<unknown>) => waits.push(work) });
    await Promise.all(waits);
  };
  const push = async (data: unknown) => {
    await fire("push", { data });
    return scope.registration.showNotification.mock.calls.at(-1);
  };
  const click = (url: unknown) => fire("notificationclick", { notification: { close: vi.fn(), data: url === undefined ? null : { url } } });
  return { scope, fire, push, click };
}

const payload = (message: unknown) => ({ json: () => message });
const tab = (url: string): Tab => ({ url, focus: vi.fn(async () => undefined), navigate: vi.fn(async () => null) });

describe("service worker", () => {
  it("takes over at once", async () => {
    const { scope, fire } = worker();
    await fire("install", {});
    await fire("activate", {});
    expect(scope.skipWaiting).toHaveBeenCalled();
    expect(scope.clients.claim).toHaveBeenCalled();
  });

  it("shows the server's message, replacing one with the same tag", async () => {
    const { push } = worker();
    expect(await push(payload({ title: "New messages: 2", body: "Flat", url: "/en/messages/c1", tag: "n1" }))).toEqual([
      "New messages: 2",
      { body: "Flat", icon: "/icons/icon-192.png", tag: "n1", renotify: true, data: { url: `${ORIGIN}/en/messages/c1` } },
    ]);
  });

  it.each([
    ["no data", null],
    ["data that is not JSON", { json: () => JSON.parse("{") }],
    ["JSON that is not an object", payload("hello")],
    ["fields of the wrong kind", payload({ title: 3, body: null, url: 5, tag: {} })],
  ])("always shows something for %s, since Safari drops silent push", async (_name, data) => {
    const { push } = worker();
    expect(await push(data)).toEqual(["MTeam", { body: "", icon: "/icons/icon-192.png", data: { url: `${ORIGIN}/ka` } }]);
  });

  it.each([
    ["another site", "https://evil.test/phish"],
    ["an address that cannot be read", "http://["],
  ])("opens the home page instead of %s", async (_name, url) => {
    const { push } = worker();
    expect((await push(payload({ title: "x", url })))?.[1]).toMatchObject({ data: { url: `${ORIGIN}/ka` } });
  });

  it("focuses a tab already on the page", async () => {
    const open = tab(`${ORIGIN}/en/messages/c1`);
    const { scope, click } = worker([tab(`${ORIGIN}/en`), open]);
    await click(`${ORIGIN}/en/messages/c1`);
    expect(open.focus).toHaveBeenCalled();
    expect(scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it("brings an open tab of the site to the page", async () => {
    const other = tab(`${ORIGIN}/en`);
    const { click } = worker([other]);
    await click(`${ORIGIN}/en/my-listings`);
    expect(other.focus).toHaveBeenCalled();
    expect(other.navigate).toHaveBeenCalledWith(`${ORIGIN}/en/my-listings`);
  });

  it("opens a window when no tab is open, and never another site", async () => {
    const { scope, click } = worker();
    await click(`${ORIGIN}/ru/listings/7`);
    expect(scope.clients.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/ru/listings/7`);
    await click("https://evil.test/");
    expect(scope.clients.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/ka`);
    await click(undefined);
    expect(scope.clients.openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/ka`);
  });
});

describe("web app manifest", () => {
  it("installs as MTeam in its own window, starting on the Georgian home page in the brand colour", () => {
    expect(manifest()).toMatchObject({ name: "MTeam", start_url: "/ka", display: "standalone", theme_color: "#986DC6" });
    expect(manifest().icons?.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
  });
});
