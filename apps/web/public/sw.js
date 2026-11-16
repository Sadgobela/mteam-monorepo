// MTeam's service worker: shows push notifications and opens them. It caches nothing; the site needs the network anyway.
// Tested in src/app/service-worker.test.ts.
const FALLBACK_PATH = "/ka";

self.addEventListener("install", () => self.skipWaiting());
// Takes over open tabs at once, so a click can reuse them.
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const text = (value) => (typeof value === "string" ? value : "");

/** The server's message, or an empty one when it cannot be read: Safari stops push for a site whose push shows nothing. */
function read(data) {
  try {
    const message = data ? data.json() : null;
    return message && typeof message === "object" ? message : {};
  } catch {
    return {};
  }
}

/** Only this site's pages open from a notification. */
function ownUrl(value) {
  const fallback = new URL(FALLBACK_PATH, self.location.origin).href;
  try {
    const url = new URL(text(value) || FALLBACK_PATH, self.location.origin);
    return url.origin === self.location.origin ? url.href : fallback;
  } catch {
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const message = read(event.data);
  const tag = text(message.tag);
  event.waitUntil(
    self.registration.showNotification(text(message.title) || "MTeam", {
      body: text(message.body),
      icon: "/icons/icon-192.png",
      // The same tag replaces the earlier notification, and still alerts.
      ...(tag ? { tag, renotify: true } : {}),
      data: { url: ownUrl(message.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = ownUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(async (tabs) => {
      const open = tabs.find((tab) => tab.url === url);
      if (open) return open.focus();
      const [tab] = tabs;
      if (!tab) return self.clients.openWindow(url);
      await tab.focus();
      return tab.navigate(url);
    }),
  );
});
