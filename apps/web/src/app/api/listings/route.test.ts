// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ createListing: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const photos = vi.hoisted(() => ({ readPhotos: vi.fn(), uploadPhoto: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/photos", () => photos);

import { POST } from "./route";

const fields = {
  deal: "sale",
  type: "apartment",
  city: "თბილისი",
  district: "ვაკე",
  address: "Main 1",
  title: "Flat",
  description: "Sunny",
  price: "1000",
  currency: "USD",
  area: "50",
  rooms: "2",
};
const LIMIT = 55 * 1024 * 1024;

const form = (overrides: Record<string, string> = {}, files: Blob[] = [new Blob(["x"])]) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
  for (const file of files) data.append("photos", file, "a.jpg");
  return data;
};

/** Content-Length is set by hand: a Request built in a test has none, and a browser always sends one with a form. */
const post = (body: FormData | string = form(), length: string | null = "1000") =>
  new Request("http://localhost/api/listings", { method: "POST", body, headers: length === null ? {} : { "content-length": length } });

const send = async (request: Request) => {
  const response = await POST(request);
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  photos.readPhotos.mockResolvedValue(["p1", "p2"]);
  photos.uploadPhoto.mockImplementation(async (p: string) => `https://cdn/${p}.jpg`);
});

describe("POST /api/listings", () => {
  it("creates the listing for the signed-in user with uploaded photos in order", async () => {
    expect(await send(post())).toEqual([200, {}]);
    expect(db.createListing).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Flat", price: 1000 }), [
      "https://cdn/p1.jpg",
      "https://cdn/p2.jpg",
    ]);
  });

  it("turns away a visitor without reading the body", async () => {
    session.currentUser.mockResolvedValue(null);
    const request = post(form(), "60000000");
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([401, { error: "signedOut" }]);
    expect(read).not.toHaveBeenCalled();
    expect(photos.uploadPhoto).not.toHaveBeenCalled();
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it.each([
    ["over the limit", String(LIMIT + 1024 * 1024)],
    ["without a stated size", null],
    ["with a nonsense size", "abc"],
    ["with a zero size", "0"],
  ])("refuses a body %s without reading it", async (_name, length) => {
    const request = post(form(), length);
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([413, { error: "photos" }]);
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts a full set of photos at the limit", async () => {
    expect((await send(post(form(), String(LIMIT))))[0]).toBe(200);
  });

  it("reports a body that is not a form", async () => {
    expect(await send(post("not a form"))).toEqual([400, { error: "invalid" }]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("accepts a street of the chosen district", async () => {
    expect((await send(post(form({ street: "ჭავჭავაძე ი. გამზირი" }))))[0]).toBe(200);
    expect(db.createListing.mock.calls[0][1]).toMatchObject({ street: "ჭავჭავაძე ი. გამზირი" });
  });

  it("accepts a street of a city that has no districts", async () => {
    const data = form({ city: "რუსთავი", street: "აღმაშენებლის გამზ." });
    data.delete("district");
    expect((await send(post(data)))[0]).toBe(200);
  });

  it("refuses a street that is not in the chosen district", async () => {
    expect(await send(post(form({ street: "invented street" })))).toEqual([422, { error: "invalid" }]);
    expect(photos.readPhotos).not.toHaveBeenCalled();
  });

  it("reports invalid fields before touching photos", async () => {
    expect(await send(post(form({ title: " " })))).toEqual([422, { error: "invalid" }]);
    expect(photos.readPhotos).not.toHaveBeenCalled();
  });

  it("ignores the empty file a browser sends for an empty input", async () => {
    photos.readPhotos.mockResolvedValue(null);
    expect(await send(post(form({}, [new Blob([])])))).toEqual([422, { error: "photos" }]);
    expect(photos.readPhotos).toHaveBeenCalledWith([]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("creates no listing if an upload fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    photos.uploadPhoto.mockRejectedValue(new Error("down"));
    expect(await send(post())).toEqual([500, { error: "save" }]);
    expect(db.createListing).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("returns an error instead of crashing if the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.createListing.mockRejectedValue(new Error("down"));
    expect(await send(post())).toEqual([500, { error: "save" }]);
  });
});
