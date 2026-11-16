"use client";

import { useEffect, useState } from "react";
import type { Dict, Locale } from "@mteam/shared";

type State = "checking" | "unsupported" | "install" | "blocked" | "off" | "on";

/** iPhone and iPad, counting iPadOS, which calls itself a Mac with a touch screen. */
const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Opened from the home screen rather than in the browser. */
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The VAPID public key, base64url as the server has it, in the bytes browsers expect. */
const keyBytes = (key: string) => Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

/** Whether a subscription was made with this key. One made with an earlier key pair can no longer be sent to. */
const madeWith = (subscription: PushSubscription, key: Uint8Array) => {
  const own = subscription.options.applicationServerKey;
  return own !== null && new Uint8Array(own).join() === key.join();
};

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Where this browser stands. "On" only when it is subscribed for this user; someone else may have turned it on before. */
async function detect(publicKey: string, endpoints: string[]): Promise<State> {
  // On iPhone, Safari offers push only to sites added to the home screen.
  if (isAppleMobile() && !isInstalled()) return "install";
  if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const subscription = await currentSubscription();
  const mine = subscription && endpoints.includes(subscription.endpoint) && madeWith(subscription, keyBytes(publicKey));
  return Notification.permission === "granted" && mine ? "on" : "off";
}

async function post(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
}

/**
 * Turns push on or off for the browser showing the page. Permission is asked only when the button is pressed, never on
 * page load. `endpoints` are the user's subscribed browsers, so a browser turned on by someone else shows as off here.
 */
export function PushDevice({ publicKey, locale, endpoints, copy }: { publicKey: string; locale: Locale; endpoints: string[]; copy: Dict["push"] }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    detect(publicKey, endpoints).then(setState, () => setState("unsupported"));
  }, [publicKey, endpoints]);

  const run = async (work: () => Promise<State>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await work());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      // Asked first, while the tap still counts: Safari shows the question only in answer to one.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
      await navigator.serviceWorker.register("/sw.js");
      const { pushManager } = await navigator.serviceWorker.ready;
      const key = keyBytes(publicKey);
      let subscription = await pushManager.getSubscription();
      if (subscription && !madeWith(subscription, key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await post("/api/push/subscribe", { ...subscription.toJSON(), locale });
      return "on";
    });

  const turnOff = () =>
    run(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await post("/api/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      return "off";
    });

  if (state === "checking") return null;
  return (
    <div aria-live="polite">
      {state === "install" && (
        <>
          <p className="settings-hint">{copy.install}</p>
          <ol className="settings-consequences">
            {copy.installSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
      {state === "unsupported" && <p className="settings-hint">{copy.unsupported}</p>}
      {state === "blocked" && <p className="settings-hint">{copy.blocked}</p>}
      {state === "off" && (
        <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={turnOn}>
          {copy.turnOn}
        </button>
      )}
      {state === "on" && (
        <div className="settings-row">
          <span>{copy.on}</span>
          <button type="button" className="btn ghost" disabled={busy} aria-busy={busy} onClick={turnOff}>
            {copy.turnOff}
          </button>
        </div>
      )}
      {failed && <p className="note settings-error" role="alert">{copy.failed}</p>}
    </div>
  );
}
