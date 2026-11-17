import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react-native";
import type { Me } from "@/lib/api";
import { LocaleProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";

function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <SessionProvider>{children}</SessionProvider>
    </LocaleProvider>
  );
}

/** Renders a screen inside the app's providers, as the root layout does; a rerender keeps them. */
export async function renderApp(ui: ReactElement) {
  return await render(ui, { wrapper: Providers });
}

/** A fetch answer with a JSON body. */
export const answer = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;

export const listing = {
  id: 7,
  deal: "sale",
  type: "apartment",
  title: "Flat",
  city: "თბილისი",
  district: "ვაკე",
  address: "Chavchavadze 1",
  price: 120000,
  currency: "USD",
  area: 80,
  rooms: 3,
  floor: 4,
  floors: 9,
  specs: {},
  features: [],
  description: "მზიანი ბინა",
  descriptionEn: "Sunny flat",
  verified: true,
  sellerId: "u1",
  images: ["https://cdn.test/listings/a.jpg", "https://cdn.test/listings/b.jpg"],
  tone: "violet",
  updatedAt: "2026-11-17T00:00:00Z",
} as const;

type Reply = Response | Error | ((init: RequestInit) => Response | Promise<Response>);

/**
 * A fetch that answers by path, ignoring the site's address and query. A route that is missing answers 404, an Error
 * rejects as when offline, and a function sees the request.
 */
export function serve(routes: Record<string, Reply | Reply[]>) {
  const queues = new Map(Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const key = `${init.method ?? "GET"} ${path}`;
    const queue = queues.get(key) ?? queues.get(path);
    if (!queue) return answer({ error: "notFound" }, 404);
    const reply = queue.length > 1 ? queue.shift()! : queue[0];
    if (reply instanceof Error) throw reply;
    return typeof reply === "function" ? reply(init) : reply;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock as jest.Mock;
}

export const me: Me = { id: "u1", name: "Nino", phone: "+995555123456", role: "USER", onboarded: true, favoriteIds: [], unread: 0 };

/** Starts the next render signed in as `user`. */
export function signedIn(user: Partial<Me> = {}): Me {
  jest.requireMock("expo-secure-store").getItemAsync.mockImplementation(async (key: string) => (key === "session" ? "tok" : null));
  return { ...me, ...user };
}
