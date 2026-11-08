import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ createListing: vi.fn(), getListing: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));
const photos = vi.hoisted(() => ({ readPhotos: vi.fn(), uploadPhoto: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/photos", () => photos);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("leaflet", () => ({
  default: {
    map: () => {
      const map = { setView: () => map, fitBounds: () => map, remove: () => undefined, on: () => undefined };
      return map;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    circleMarker: () => ({ bindPopup: () => ({ addTo: () => undefined }), addTo: () => undefined }),
    latLngBounds: (points: unknown) => points,
  },
}));

import { ListingCard } from "@/components/ListingCard";
import { ListingForm } from "@/components/ListingForm";
import { createListingAction } from "@/lib/listing-actions";
import ListingPage from "./[locale]/listings/[id]/page";
import NewListingPage from "./[locale]/listings/new/page";

const t = getDictionary("en");
const fields = {
  locale: "en",
  deal: "sale",
  type: "apartment",
  city: "tbilisi",
  district: "Vake",
  address: "Main 1",
  title: "Flat",
  description: "Sunny",
  price: "1000",
  currency: "USD",
  area: "50",
  rooms: "2",
};
const form = (overrides: Record<string, string> = {}, files: Blob[] = [new Blob(["x"])]) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
  for (const file of files) data.append("photos", file, "a.jpg");
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  photos.readPhotos.mockResolvedValue(["p1", "p2"]);
  photos.uploadPhoto.mockImplementation(async (p: string) => `https://cdn/${p}.jpg`);
});

describe("createListingAction", () => {
  it("creates the listing for the signed-in user with uploaded photos in order", async () => {
    await expect(createListingAction({}, form())).rejects.toThrow("REDIRECT /en/listings/new?sent=1");
    expect(db.createListing).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Flat", price: 1000 }), [
      "https://cdn/p1.jpg",
      "https://cdn/p2.jpg",
    ]);
  });

  it("sends a visitor to login and stores nothing", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(createListingAction({}, form())).rejects.toThrow("REDIRECT /en/login");
    expect(photos.uploadPhoto).not.toHaveBeenCalled();
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("reports invalid fields before touching photos", async () => {
    expect(await createListingAction({}, form({ title: " " }))).toEqual({ error: "invalid" });
    expect(photos.readPhotos).not.toHaveBeenCalled();
  });

  it("ignores the empty file a browser sends for an empty input", async () => {
    photos.readPhotos.mockResolvedValue(null);
    expect(await createListingAction({}, form({}, [new Blob([])]))).toEqual({ error: "photos" });
    expect(photos.readPhotos).toHaveBeenCalledWith([]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("creates no listing if an upload fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    photos.uploadPhoto.mockRejectedValue(new Error("down"));
    expect(await createListingAction({}, form())).toEqual({ error: "save" });
    expect(db.createListing).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("returns an error instead of crashing if the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.createListing.mockRejectedValue(new Error("down"));
    expect(await createListingAction({}, form())).toEqual({ error: "save" });
  });
});

describe("ListingForm", () => {
  it("keeps what was typed and shows the error when the server rejects it", async () => {
    render(<ListingForm locale="en" t={t} />);
    const title = screen.getByLabelText(t.post.fields.title);
    fireEvent.change(title, { target: { value: "My flat" } });
    fireEvent.submit(title.closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.invalid);
    await waitFor(() => expect(title).toHaveValue("My flat"));
  });

  it.each([
    ["too many photos", Array.from({ length: 11 }, () => new File(["x"], "a.jpg"))],
    ["an oversized photo", [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.jpg")]],
  ])("rejects %s in the browser without sending anything", async (_name, files) => {
    render(<ListingForm locale="en" t={t} />);
    // jsdom leaves assigned files out of FormData, so the submitted photos are supplied directly.
    const getAll = vi.spyOn(FormData.prototype, "getAll").mockReturnValue(files);
    fireEvent.submit(screen.getByLabelText(t.post.fields.photos).closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.photos);
    expect(session.currentUser).not.toHaveBeenCalled();
    getAll.mockRestore();
  });

  it("previews chosen photos and releases the previous ones", () => {
    const created = vi.fn().mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    const revoked = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }));
    const { container } = render(<ListingForm locale="en" t={t} />);
    const input = screen.getByLabelText(t.post.fields.photos);

    expect(container.querySelector(".previews")).toBeNull();
    fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg")] } });
    expect(container.querySelector(".previews img")).toHaveAttribute("src", "blob:one");
    fireEvent.change(input, { target: { files: [new File(["y"], "b.jpg")] } });
    expect(revoked).toHaveBeenCalledWith("blob:one");
    expect(container.querySelector(".previews img")).toHaveAttribute("src", "blob:two");
    vi.unstubAllGlobals();
  });

  it("offers translated choices", () => {
    render(<ListingForm locale="en" t={getDictionary("ru")} />);
    expect(screen.getByRole("option", { name: "Батуми" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "AED" })).toBeInTheDocument();
  });
});

describe("NewListingPage", () => {
  const params = Promise.resolve({ locale: "en" });

  it("requires a valid session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(NewListingPage({ params, searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /en/login");
  });

  it("shows the form", async () => {
    render(await NewListingPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: t.post.submit })).toBeInTheDocument();
  });

  it("confirms a submitted listing", async () => {
    render(await NewListingPage({ params, searchParams: Promise.resolve({ sent: "1" }) }));
    expect(screen.getByRole("status")).toHaveTextContent(t.post.sent);
    expect(screen.queryByRole("button", { name: t.post.submit })).toBeNull();
  });
});

describe("listing photos", () => {
  const withPhotos = { ...fixtureListings[0], images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] };

  it("shows the first photo on a card", () => {
    render(<ListingCard listing={withPhotos} locale="en" t={t} />);
    expect(screen.getByRole("img", { name: withPhotos.title })).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("omits the room count on a card for property without rooms", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], rooms: 0 }} locale="en" t={t} />);
    expect(screen.queryByText(/rooms/)).toBeNull();
  });

  it("shows every photo on the listing page", async () => {
    db.getListing.mockResolvedValue(withPhotos);
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }) }));
    expect(screen.getAllByRole("img", { name: new RegExp(withPhotos.title) }).map((i) => i.getAttribute("src"))).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
  });

  it("says who checked a verified listing and when", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], verification: { by: "Nino", at: "2026-11-05" } });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }) }));
    expect(screen.getByText("Checked by Nino, Nov 5")).toBeInTheDocument();
  });

  it("shows a map only when the listing has a location", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], lat: 41.7, lng: 44.7 });
    const pinned = render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }) }));
    expect(screen.getByRole("region", { name: t.results.map })).toBeInTheDocument();
    pinned.unmount();
    db.getListing.mockResolvedValue({ ...fixtureListings[0], lat: 41.7 });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }) }));
    expect(screen.queryByRole("region", { name: t.results.map })).toBeNull();
  });

  it("omits the rooms fact for property without rooms", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], rooms: 0 });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }) }));
    expect(screen.queryByText(t.listing.rooms)).toBeNull();
  });
});
