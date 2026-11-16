// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ claimPhotoUpload: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const photos = vi.hoisted(() => ({ readPhotos: vi.fn(), uploadPhoto: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/photos", () => photos);

import { POST } from "./route";

const LIMIT = 4 * 1024 * 1024 + 64 * 1024;

const form = (photo: Blob | string = new Blob(["x"])) => {
  const data = new FormData();
  if (typeof photo === "string") data.set("photo", photo);
  else data.set("photo", photo, "a.jpg");
  return data;
};

const post = (body: FormData | string = form(), length: string | null = "1000") =>
  new Request("http://localhost/api/listings/photos", { method: "POST", body, headers: length === null ? {} : { "content-length": length } });

const send = async (request: Request) => {
  const response = await POST(request);
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456", onboardedAt: new Date("2026-11-16T00:00:00Z") });
  db.claimPhotoUpload.mockResolvedValue(true);
  photos.readPhotos.mockResolvedValue(["p1"]);
  photos.uploadPhoto.mockResolvedValue("https://cdn/p1.jpg");
});

describe("POST /api/listings/photos", () => {
  it("stores one photo for a signed-in user and returns its address", async () => {
    expect(await send(post())).toEqual([200, { url: "https://cdn/p1.jpg" }]);
    expect(photos.readPhotos).toHaveBeenCalledWith([expect.any(File)]);
    expect(db.claimPhotoUpload).toHaveBeenCalledWith("u1");
  });

  it("turns away a request sent from another site's page, before anything else", async () => {
    const request = new Request("http://localhost/api/listings/photos", { method: "POST", body: "x", headers: { origin: "https://evil.test", "content-length": "1" } });
    expect(await send(request)).toEqual([403, { error: "crossSite" }]);
    expect(session.currentUser).not.toHaveBeenCalled();
  });

  it("accepts a request from our own page", async () => {
    const request = post();
    request.headers.set("origin", "http://localhost");
    expect((await send(request))[0]).toBe(200);
  });

  it.each([
    ["a visitor", null, 401, "signedOut"],
    ["someone without a phone", { id: "u1", phone: null }, 403, "noPhone"],
    ["someone who has not finished onboarding", { id: "u1", phone: "+995555123456", onboardedAt: null }, 403, "noOnboarding"],
  ])("turns away %s without reading the body", async (_name, user, status, error) => {
    session.currentUser.mockResolvedValue(user);
    const request = post();
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([status, { error }]);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["over the limit", String(LIMIT + 1)],
    ["without a stated size", null],
    ["with a zero size", "0"],
  ])("refuses a body %s without reading it", async (_name, length) => {
    const request = post(form(), length);
    const read = vi.spyOn(request, "formData");
    expect(await send(request)).toEqual([413, { error: "photos" }]);
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts a photo at the limit", async () => {
    expect((await send(post(form(), String(LIMIT))))[0]).toBe(200);
  });

  it("stops an account that uploads too many", async () => {
    db.claimPhotoUpload.mockResolvedValue(false);
    expect(await send(post())).toEqual([429, { error: "tooMany" }]);
    expect(photos.uploadPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ["a body that is not a form", "not a form"],
    ["a form without a file", form("text")],
  ])("refuses %s", async (_name, body) => {
    expect(await send(post(body))).toEqual([422, { error: "photos" }]);
    expect(photos.uploadPhoto).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a photo", async () => {
    photos.readPhotos.mockResolvedValue(null);
    expect(await send(post())).toEqual([422, { error: "photos" }]);
  });

  it("reports a failed upload", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    photos.uploadPhoto.mockRejectedValue(new Error("down"));
    expect(await send(post())).toEqual([500, { error: "save" }]);
    expect(log).toHaveBeenCalled();
  });
});
