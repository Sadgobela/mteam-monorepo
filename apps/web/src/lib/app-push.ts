import { z } from "zod";
import { deleteExpiredAppPushTokens, listAppPushTargets, markAppPushTokensUsed, type CreatedNotification } from "@mteam/db";
import { pushMessage } from "./push";

/** Expo's push service, which hands each message on to Apple or Google. */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TIMEOUT_MS = 10_000;
/** A day, as for browsers: news older than that is waiting in the app anyway. */
const TTL_SECONDS = 24 * 60 * 60;

/** The shape of an Expo push token, as the app sends it. */
export const expoPushTokenSchema = z.string().regex(/^Expo(nent)?PushToken\[[\w-]{10,100}\]$/);

const ticketsSchema = z.object({
  data: z.array(z.object({ status: z.enum(["ok", "error"]), details: z.object({ error: z.string() }).partial().optional() })),
});

/**
 * Sends each notification to its user's phones, in the language each phone turned push on in. The message carries the
 * site path the notification leads to, which the app opens as its own screen. An optional EXPO_ACCESS_TOKEN is sent when
 * the Expo project requires one.
 */
export async function deliverToApps(notices: CreatedNotification[]): Promise<void> {
  for (const notice of notices) {
    const targets = await listAppPushTargets(notice.userId);
    if (targets.length === 0) continue;
    const messages = targets.map((target) => {
      const { title, body, url, tag } = pushMessage(notice, target.locale);
      return { to: target.token, title, body, data: { url, tag }, sound: "default", ttl: TTL_SECONDS };
    });
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const tickets = ticketsSchema.safeParse(response.ok ? await response.json() : null);
    if (!tickets.success) {
      console.error(`app push: Expo answered ${response.status}`);
      continue;
    }
    const sent: string[] = [];
    const gone: string[] = [];
    tickets.data.data.forEach((ticket, index) => {
      const token = targets[index]?.token;
      if (!token) return;
      if (ticket.status === "ok") sent.push(token);
      else if (ticket.details?.error === "DeviceNotRegistered") gone.push(token);
      else console.error(`app push: ${ticket.details?.error ?? "error"}`);
    });
    if (gone.length > 0) await deleteExpiredAppPushTokens(gone);
    if (sent.length > 0) await markAppPushTokensUsed(sent);
  }
}
