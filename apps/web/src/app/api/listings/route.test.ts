// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ createListing: vi.fn(), getEditableListing: vi.fn(), saveDraft: vi.fn(), updateListing: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const photos = vi.hoisted(() => ({ isUploadedPhoto: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/photos", () => photos);

import { POST } from "./route";

const fields = {
  intent: "submit",
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
const uploaded = ["https://cdn/listings/a.jpg", "https://cdn/listings/b.jpg"];

const form = (overrides: Record<string, string> = {}, urls: string[] = uploaded) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
  for (const url of urls) data.append("photos", url);
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
  session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456", role: "USER", agent: null });
  photos.isUploadedPhoto.mockImplementation((url: string) => url.startsWith("https://cdn/listings/"));
  db.createListing.mockResolvedValue(7);
  db.getEditableListing.mockResolvedValue({ id: 9, status: "ACTIVE", fields: {}, images: ["https://old.test/x.jpg"] });
  db.updateListing.mockResolvedValue("ACTIVE");
  db.saveDraft.mockResolvedValue(12);
});

describe("POST /api/listings", () => {
  it("creates the listing for the signed-in user with its photos in order", async () => {
    expect(await send(post())).toEqual([200, { id: 7, status: "PENDING" }]);
    expect(db.createListing).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Flat", price: 1000 }), uploaded, null);
  });

  it("posts a broker's listing as the broker's, but not for someone who lost the role", async () => {
    session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456", role: "AGENT", agent: { id: "a1" } });
    await send(post());
    expect(db.createListing.mock.calls[0][3]).toBe("a1");
    session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456", role: "USER", agent: { id: "a1" } });
    await send(post(form({ intent: "draft" })));
    expect(db.saveDraft.mock.calls[0][4]).toBeNull();
    session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456", role: "AGENT", agent: null });
    await send(post());
    expect(db.createListing.mock.calls[1][3]).toBeNull();
  });

  it.each([
    ["a visitor", null, 401, "signedOut"],
    ["someone without a phone, which the listing needs as its contact", { id: "u1", phone: null }, 403, "noPhone"],
  ])("turns away %s without reading the body", async (_name, user, status, error) => {
    session.currentUser.mockResolvedValue(user);
    const request = post();
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([status, { error }]);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["over the limit", String(256 * 1024 + 1)],
    ["without a stated size", null],
    ["with a nonsense size", "abc"],
  ])("refuses a body %s without reading it", async (_name, length) => {
    const request = post(form(), length);
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([413, { error: "invalid" }]);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["a body that is not a form", "not a form"],
    ["an unknown intent", form({ intent: "publish" })],
  ])("refuses %s", async (_name, body) => {
    expect(await send(post(body))).toEqual([400, { error: "invalid" }]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("accepts a street of the chosen district, and of a city that has no districts", async () => {
    expect((await send(post(form({ street: "ჭავჭავაძე ი. გამზირი" }))))[0]).toBe(200);
    const data = form({ city: "რუსთავი", street: "აღმაშენებლის გამზ." });
    data.delete("district");
    expect((await send(post(data)))[0]).toBe(200);
  });

  it.each([
    ["a street that is not in the chosen district", { street: "invented street" }],
    ["a blank title", { title: " " }],
  ])("refuses %s", async (_name, change) => {
    expect(await send(post(form(change)))).toEqual([422, { error: "invalid" }]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it.each([
    ["no photos", []],
    ["a photo from anywhere else", ["https://evil.test/a.jpg"]],
    ["too many photos", Array.from({ length: 17 }, () => uploaded[0])],
  ])("refuses a listing with %s", async (_name, urls) => {
    expect(await send(post(form({}, urls)))).toEqual([422, { error: "photos" }]);
    expect(db.createListing).not.toHaveBeenCalled();
  });

  it("returns an error instead of crashing if the database fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.createListing.mockRejectedValue(new Error("down"));
    expect(await send(post())).toEqual([500, { error: "save" }]);
    expect(log).toHaveBeenCalled();
  });

  describe("editing", () => {
    it("saves the owner's edit, keeping a photo the listing already had, and says what became of it", async () => {
      const urls = ["https://old.test/x.jpg", uploaded[0]];
      expect(await send(post(form({ id: "9" }, urls)))).toEqual([200, { id: 9, status: "ACTIVE" }]);
      expect(db.getEditableListing).toHaveBeenCalledWith("u1", "9");
      expect(db.updateListing).toHaveBeenCalledWith("u1", 9, expect.objectContaining({ title: "Flat" }), urls);
    });

    it("finds nothing to edit in someone else's listing", async () => {
      db.getEditableListing.mockResolvedValue(null);
      expect(await send(post(form({ id: "9" })))).toEqual([404, { error: "missing" }]);
      expect(db.updateListing).not.toHaveBeenCalled();
    });

    it("reports a listing that stopped being editable while it was saved", async () => {
      db.updateListing.mockResolvedValue(null);
      expect(await send(post(form({ id: "9" })))).toEqual([404, { error: "missing" }]);
    });
  });

  describe("drafts", () => {
    it("starts a draft from an unfinished form, photos optional", async () => {
      const data = form({ intent: "draft", title: "", price: "" }, []);
      expect(await send(post(data))).toEqual([200, { id: 12, status: "DRAFT" }]);
      expect(db.saveDraft).toHaveBeenCalledWith("u1", null, expect.objectContaining({ city: "თბილისი" }), [], null);
    });

    it("updates the draft it was given", async () => {
      expect((await send(post(form({ intent: "draft", id: "9" }))))[0]).toBe(200);
      expect(db.saveDraft).toHaveBeenCalledWith("u1", 9, expect.anything(), uploaded, null);
    });

    it("refuses a field filled in wrongly", async () => {
      expect(await send(post(form({ intent: "draft", area: "lots" })))).toEqual([422, { error: "invalid" }]);
      expect(db.saveDraft).not.toHaveBeenCalled();
    });

    it("reports a draft it could not save: not a draft any more, or too many", async () => {
      db.saveDraft.mockResolvedValue(null);
      expect(await send(post(form({ intent: "draft" })))).toEqual([404, { error: "missing" }]);
    });
  });
});
