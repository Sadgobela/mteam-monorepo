// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ fetch: vi.fn(), options: [] as unknown[] }));

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    constructor(options: unknown) {
      storage.options.push(options);
    }
    fetch = storage.fetch;
  },
}));

import sharp from "sharp";
import { isUploadedPhoto, oneAtATime, readPhotos, uploadPhoto } from "./photos";

const blank = (width = 8, height = 6) => sharp({ create: { width, height, channels: 3, background: "#986dc6" } });
const file = (bytes: Uint8Array | number[], name = "a.jpg", type = "image/jpeg") => new File([new Uint8Array(bytes)], name, { type });
const FOUR_MB = 4 * 1024 * 1024;

let jpeg: Buffer;
let png: Buffer;
let webp: Buffer;

beforeAll(async () => {
  jpeg = await blank().jpeg().toBuffer();
  png = await blank().png().toBuffer();
  webp = await blank().webp().toBuffer();
});

describe("readPhotos", () => {
  it("stores every format it recognises as WebP, with a small copy", async () => {
    const photos = (await readPhotos([file(jpeg), file(png), file(webp)])) ?? [];
    expect(photos.map((p) => [p.type, p.ext])).toEqual([
      ["image/webp", "webp"],
      ["image/webp", "webp"],
      ["image/webp", "webp"],
    ]);
    const decoded = await Promise.all(photos.flatMap((p) => [sharp(p.bytes).metadata(), sharp(p.thumb).metadata()]));
    expect(new Set(decoded.map((d) => d.format))).toEqual(new Set(["webp"]));
  });

  it("brings a large photo down to 2048 pixels and its copy to 640, and never enlarges a small one", async () => {
    // A camera-sized photo with edges and grain, so the sizes say something about real ones: about 1.1 MB as a JPEG,
    // 330 KB as the stored WebP and 60 KB as its copy when this was written.
    const width = 4032;
    const height = 3024;
    const pixels = Buffer.alloc(width * height * 3);
    for (let i = 0; i < pixels.length; i++) {
      const pixel = (i / 3) | 0;
      pixels[i] = ((((pixel % width) >> 4) ^ ((pixel / width) >> 4)) * 5 + (i % 3) * 40 + (Math.imul(i, 2654435761) >>> 29)) & 255;
    }
    const camera = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
    const [photo] = (await readPhotos([file(camera)])) ?? [];
    const [main, thumb] = await Promise.all([sharp(photo.bytes).metadata(), sharp(photo.thumb).metadata()]);
    expect([main.width, main.height]).toEqual([2048, 1536]);
    expect([thumb.width, thumb.height]).toEqual([640, 480]);
    expect(photo.bytes.length).toBeLessThan(camera.length / 2);
    expect(photo.thumb.length).toBeLessThan(photo.bytes.length / 4);

    const [small] = (await readPhotos([file(jpeg)])) ?? [];
    expect((await sharp(small.bytes).metadata()).width).toBe(8);
  });

  it.each(["jpeg", "png", "webp"] as const)("leaves no GPS position or other metadata in a %s", async (format) => {
    const tagged = await blank()
      .toFormat(format)
      .withExif({ IFD0: { Copyright: "hidden-owner-note" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 42/1 0/1" } })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    expect(tagged.includes("hidden-owner-note")).toBe(true);

    const [photo] = (await readPhotos([file(tagged)])) ?? [];
    expect((await sharp(photo.bytes).metadata()).exif).toBeUndefined();
    expect(Buffer.from(photo.bytes).includes("hidden-owner-note")).toBe(false);
    expect((await sharp(photo.thumb).metadata()).exif).toBeUndefined();
  });

  it("applies a photo's rotation before dropping it", async () => {
    const sideways = await blank(8, 6).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const [photo] = (await readPhotos([file(sideways)])) ?? [];
    const result = await sharp(photo.bytes).metadata();
    expect([result.width, result.height, result.orientation]).toEqual([6, 8, undefined]);
  });

  it("accepts a photo with a minor flaw that browsers display normally", async () => {
    const scan = jpeg.indexOf(Buffer.from([0xff, 0xda]));
    const flawed = Buffer.concat([jpeg.subarray(0, scan), Buffer.from([1, 2, 3]), jpeg.subarray(scan)]);
    await expect(sharp(flawed, { failOn: "warning" }).toBuffer()).rejects.toThrow(/extraneous/);
    expect(await readPhotos([file(flawed)])).toHaveLength(1);
  });

  it("rejects a photo cut off part way through", async () => {
    const whole = await sharp(Buffer.alloc(900 * 900 * 3, 120), { raw: { width: 900, height: 900, channels: 3 } }).jpeg().toBuffer();
    expect(await readPhotos([file(whole.subarray(0, 200))])).toBeNull();
  });

  it("rejects a file that starts like an image but is not one", async () => {
    expect(await readPhotos([file([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])])).toBeNull();
  });

  it("rejects an image with too many pixels to decode safely", async () => {
    const huge = await blank(8000, 8000).png().toBuffer();
    expect(huge.length).toBeLessThan(FOUR_MB);
    expect(await readPhotos([file(huge)])).toBeNull();
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

  it("allows sixteen photos and no more", async () => {
    expect(await readPhotos(Array.from({ length: 16 }, () => file(jpeg)))).toHaveLength(16);
    expect(await readPhotos(Array.from({ length: 17 }, () => file(jpeg)))).toBeNull();
  });

  it("allows 4 MB and no more", async () => {
    const atLimit = Buffer.concat([jpeg, Buffer.alloc(FOUR_MB - jpeg.length)]);
    expect(await readPhotos([file(atLimit)])).toHaveLength(1);
    expect(await readPhotos([file(Buffer.concat([atLimit, Buffer.alloc(1)]))])).toBeNull();
  });
});

describe("oneAtATime", () => {
  it("starts a job only after the one before it has finished", async () => {
    const order: string[] = [];
    let finishFirst = () => {};
    const first = oneAtATime(async () => {
      order.push("first started");
      await new Promise<void>((resolve) => (finishFirst = resolve));
      order.push("first finished");
    });
    const second = oneAtATime(async () => {
      order.push("second started");
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual(["first started"]);
    finishFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first started", "first finished", "second started"]);
  });

  it("carries on after a job fails", async () => {
    await expect(oneAtATime(async () => Promise.reject(new Error("bad")))).rejects.toThrow("bad");
    expect(await oneAtATime(async () => "next")).toBe("next");
  });
});

describe("uploadPhoto", () => {
  const photo = { bytes: new Uint8Array([1, 2, 3]), thumb: new Uint8Array([4]), type: "image/webp", ext: "webp" } as const;

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

  it("stores the copy and then the photo under one random name, cached for good, and returns the photo's public URL", async () => {
    storage.fetch.mockResolvedValue({ ok: true });
    const url = await uploadPhoto(photo);

    const [[thumbTarget, thumbInit], [target, init]] = storage.fetch.mock.calls;
    const key = /^http:\/\/localhost:8333\/photos\/(listings\/[0-9a-f-]{36})\.webp$/.exec(target)?.[1];
    expect(key).toBeDefined();
    expect(thumbTarget).toBe(`http://localhost:8333/photos/${key}_thumb.webp`);
    expect(url).toBe(`https://cdn.example.com/${key}.webp`);
    const headers = { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" };
    expect(init).toEqual({ method: "PUT", body: photo.bytes, headers });
    expect(thumbInit).toEqual({ method: "PUT", body: photo.thumb, headers });
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

describe("isUploadedPhoto", () => {
  beforeEach(() => vi.stubEnv("STORAGE_PUBLIC_URL", "https://cdn.example.com"));
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only addresses of our own uploads", () => {
    expect(isUploadedPhoto("https://cdn.example.com/listings/0f8fad5b-d9cb-469f-a165-70867728950e.webp")).toBe(true);
    expect(isUploadedPhoto("https://cdn.example.com/listings/0f8fad5b-d9cb-469f-a165-70867728950e_thumb.webp")).toBe(false);
    expect(isUploadedPhoto("https://cdn.example.com/listings/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe(false);
    expect(isUploadedPhoto("https://cdn.example.com/listings/../avatars/x.jpg")).toBe(false);
    expect(isUploadedPhoto("https://evil.test/listings/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe(false);
    expect(isUploadedPhoto("https://cdn.example.com.evil.test/listings/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe(false);
  });
});
