// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ claimAvatarUpload: vi.fn(), setAvatar: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const upload = vi.hoisted(() => vi.fn());

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
// The real checks and re-encoding run; only the storage call is replaced.
vi.mock("@/lib/photos", async (original) => ({ ...(await original<typeof import("@/lib/photos")>()), uploadPhoto: upload }));

import { POST } from "./[locale]/(account)/account/profile/avatar/route";

const wide = await sharp({ create: { width: 60, height: 30, channels: 3, background: "#986dc6" } }).jpeg().toBuffer();

const form = (photo: Blob | string = new Blob([new Uint8Array(wide)])) => {
  const data = new FormData();
  data.set("photo", photo);
  return data;
};

/** Content-Length is set by hand: a Request built in a test has none, and a browser always sends one with a form. */
const post = (body: FormData | string = form(), length: string | null = "1000", type?: string) =>
  new Request("http://localhost/en/account/profile/avatar", {
    method: "POST",
    body,
    headers: { ...(length === null ? {} : { "content-length": length }), ...(type ? { "content-type": type } : {}) },
  });

const send = async (request: Request) => {
  const response = await POST(request);
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  db.claimAvatarUpload.mockResolvedValue(true);
  upload.mockResolvedValue("https://cdn.example/a.webp");
});

describe("POST avatar", () => {
  it("crops the photo square and small, stores it and saves it on the account", async () => {
    expect(await send(post())).toEqual([200, { avatarUrl: "https://cdn.example/a.webp" }]);
    expect(db.claimAvatarUpload).toHaveBeenCalledWith("u1");
    const [stored] = upload.mock.calls[0];
    expect(stored).toMatchObject({ type: "image/webp", ext: "webp" });
    expect(await sharp(stored.bytes).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 });
    expect(db.setAvatar).toHaveBeenCalledWith("u1", "https://cdn.example/a.webp");
  });

  it("refuses a visitor before reading anything", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await send(post())).toEqual([401, { error: "signedOut" }]);
    expect(db.claimAvatarUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["no size", null],
    ["an empty body", "0"],
    ["more than one photo's limit", String(6 * 1024 * 1024)],
  ])("refuses %s before reading it", async (_, length) => {
    expect(await send(post(form(), length))).toEqual([413, { error: "photo" }]);
    expect(db.claimAvatarUpload).not.toHaveBeenCalled();
  });

  it("refuses past the hourly limit", async () => {
    db.claimAvatarUpload.mockResolvedValue(false);
    expect(await send(post())).toEqual([429, { error: "tooMany" }]);
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    ["a broken form", post("not a form", "1000", "multipart/form-data; boundary=x")],
    ["text instead of a file", post(form("hello"))],
    ["a file that is not an image", post(form(new Blob(["just text"])))],
  ])("refuses %s", async (_, request) => {
    expect(await send(request)).toEqual([422, { error: "photo" }]);
    expect(upload).not.toHaveBeenCalled();
    expect(db.setAvatar).not.toHaveBeenCalled();
  });

  it("says so when storage fails, and keeps the old photo", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    upload.mockRejectedValue(new Error("down"));
    expect(await send(post())).toEqual([500, { error: "photo" }]);
    expect(db.setAvatar).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
  });
});
