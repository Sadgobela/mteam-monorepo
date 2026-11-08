// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ fetch: vi.fn(), options: [] as unknown[] }));

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    constructor(options: unknown) {
      storage.options.push(options);
    }
    fetch = storage.fetch;
  },
}));

import { readPhotos, uploadPhoto } from "./photos";

const jpeg = [0xff, 0xd8, 0xff, 0xe0];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webp = [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")];
const file = (bytes: number[], name = "a.jpg", type = "image/jpeg") => new File([new Uint8Array(bytes)], name, { type });

describe("readPhotos", () => {
  it("recognises each format from its content", async () => {
    const photos = await readPhotos([file(jpeg), file(png), file(webp)]);
    expect(photos?.map((p) => [p.type, p.ext])).toEqual([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ]);
    expect([...(photos?.[0].bytes ?? [])]).toEqual(jpeg);
  });

  it("rejects a non-image that claims to be a JPEG", async () => {
    expect(await readPhotos([file([0x3c, 0x73, 0x76, 0x67], "x.jpg", "image/jpeg")])).toBeNull();
  });

  it("rejects the whole set if one file is bad", async () => {
    expect(await readPhotos([file(jpeg), file([1, 2, 3])])).toBeNull();
  });

  it("rejects RIFF files that are not WebP", async () => {
    expect(await readPhotos([file([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WAVE")])])).toBeNull();
  });

  it("requires at least one photo", async () => {
    expect(await readPhotos([])).toBeNull();
  });

  it("allows ten photos and no more", async () => {
    expect(await readPhotos(Array.from({ length: 10 }, () => file(jpeg)))).toHaveLength(10);
    expect(await readPhotos(Array.from({ length: 11 }, () => file(jpeg)))).toBeNull();
  });

  it("allows 5 MB and no more", async () => {
    const atLimit = [...jpeg, ...new Array(5 * 1024 * 1024 - jpeg.length).fill(0)];
    expect(await readPhotos([file(atLimit)])).toHaveLength(1);
    expect(await readPhotos([file([...atLimit, 0])])).toBeNull();
  });
});

describe("uploadPhoto", () => {
  const photo = { bytes: new Uint8Array(jpeg), type: "image/jpeg", ext: "jpg" };

  beforeEach(() => {
    storage.fetch.mockReset();
    storage.options.length = 0;
    vi.stubEnv("STORAGE_ENDPOINT", "http://localhost:8333");
    vi.stubEnv("STORAGE_BUCKET", "photos");
    vi.stubEnv("STORAGE_ACCESS_KEY_ID", "id");
    vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("STORAGE_PUBLIC_URL", "https://cdn.example.com");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("stores under a random key with the detected type and returns the public URL", async () => {
    storage.fetch.mockResolvedValue({ ok: true });
    const url = await uploadPhoto(photo);

    const [target, init] = storage.fetch.mock.calls[0];
    const key = /^http:\/\/localhost:8333\/photos\/(listings\/[0-9a-f-]{36}\.jpg)$/.exec(target)?.[1];
    expect(key).toBeDefined();
    expect(url).toBe(`https://cdn.example.com/${key}`);
    expect(init).toEqual({ method: "PUT", body: photo.bytes, headers: { "content-type": "image/jpeg" } });
    expect(storage.options[0]).toEqual({ accessKeyId: "id", secretAccessKey: "secret", service: "s3", region: "auto" });
  });

  it("fails loudly when storage refuses", async () => {
    storage.fetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(uploadPhoto(photo)).rejects.toThrow("403");
  });

  it("refuses to run without storage settings", async () => {
    vi.stubEnv("STORAGE_BUCKET", "");
    await expect(uploadPhoto(photo)).rejects.toThrow();
    expect(storage.fetch).not.toHaveBeenCalled();
  });
});
