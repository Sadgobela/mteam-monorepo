import type { PublicListing } from "@mteam/shared";
import { apiUrl } from "./config";

/** A failed call: the API's own error code, or "network" when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export interface SearchPage {
  listings: PublicListing[];
  total: number;
  page: number;
  pageSize: number;
  gelPerUsd: number;
}

export interface ListingPage {
  listing: PublicListing;
  similar: PublicListing[];
  gelPerUsd: number;
}

export interface Me {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  onboarded: boolean;
  favoriteIds: number[];
}

export type ListingStatus = "DRAFT" | "PENDING" | "ACTIVE" | "ARCHIVED" | "REJECTED";
export type MyListing = PublicListing & { status: ListingStatus };
export type Query = Record<string, string | string[] | undefined>;

let sessionToken: string | null = null;

/** The token every call sends, set by the session once signed in. */
export function setApiToken(token: string | null): void {
  sessionToken = token;
}

/** A query string from filters, leaving out the empty ones; a list repeats its name, as the site's URLs do. */
export function toSearch(query: Query): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item) params.append(name, item);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

async function call<T>(path: string, init: { method?: string; json?: unknown; form?: FormData; fields?: URLSearchParams } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  let body: string | FormData | undefined;
  if (init.form) body = init.form;
  else if (init.fields) {
    // Plain form fields, so the body has a known length: the posting endpoint checks it before reading.
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = init.fields.toString();
  } else if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let response: Response;
  try {
    response = await fetch(apiUrl() + path, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
  } catch {
    throw new ApiError("network", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(typeof data?.error === "string" ? data.error : "failed", response.status);
  return data as T;
}

/** A photo picked on the phone, sent as one file in a form, the way the site's posting form sends it. */
export interface PickedPhoto {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export const api = {
  search: (query: Query) => call<SearchPage>(`/api/v1/listings${toSearch(query)}`),
  listing: (id: string) => call<ListingPage>(`/api/v1/listings/${encodeURIComponent(id)}`),
  phone: (id: number) => call<{ phone: string }>(`/api/listings/${id}/phone`),
  requestCode: (phone: string) => call<{ phone: string }>("/api/v1/auth/code", { json: { phone } }),
  verifyCode: (phone: string, code: string) => call<{ token: string; onboarded: boolean }>("/api/v1/auth/verify", { json: { phone, code } }),
  logout: () => call<{ ok: true }>("/api/v1/auth/logout", { method: "POST" }),
  me: () => call<Me>("/api/v1/me"),
  onboard: (name: string, intent: "SEEKING" | "OWNER" | "BROKER") => call<{ ok: true }>("/api/v1/onboarding", { json: { name, intent, terms: true } }),
  favorites: () => call<{ listings: PublicListing[]; gelPerUsd: number }>("/api/v1/favorites"),
  setFavorite: (id: number, favorite: boolean) => call<{ id: number; favorite: boolean }>(`/api/v1/favorites/${id}`, { method: "PUT", json: { favorite } }),
  myListings: () => call<{ listings: MyListing[]; gelPerUsd: number }>("/api/v1/my-listings"),
  uploadPhoto: (photo: PickedPhoto) => {
    const form = new FormData();
    const type = photo.mimeType || "image/jpeg";
    // React Native's FormData takes a file as its address, type and name.
    form.append("photo", { uri: photo.uri, type, name: photo.fileName || `photo.${type.split("/")[1]}` } as unknown as Blob);
    return call<{ url: string }>("/api/listings/photos", { form });
  },
  submitListing: (fields: Record<string, string>, photos: string[]) => {
    const form = new URLSearchParams({ ...fields, intent: "submit" });
    for (const url of photos) form.append("photos", url);
    return call<{ id: number; status: ListingStatus }>("/api/listings", { fields: form });
  },
  savePush: (token: string, platform: "ios" | "android", locale: string) => call<{ ok: true }>("/api/v1/push", { json: { token, platform, locale } }),
  deletePush: (token: string) => call<{ ok: true }>("/api/v1/push", { method: "DELETE", json: { token } }),
};
