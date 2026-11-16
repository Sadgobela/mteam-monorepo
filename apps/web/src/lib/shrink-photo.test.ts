import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shrinkPhoto, withShrunkPhoto } from "./shrink-photo";

const original = new File(["raw"], "IMG_0001.HEIC", { type: "image/heic" });
const drawImage = vi.fn();
const close = vi.fn();
let blob: Blob | null;

const decodes = (width: number, height: number) => vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close })));

beforeEach(() => {
  blob = new Blob(["jpeg"], { type: "image/jpeg" });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(blob));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shrinkPhoto", () => {
  it("brings the long edge down to 1600 px as a JPEG, turned as the camera held it", async () => {
    decodes(4000, 3000);
    const shrunk = await shrinkPhoto(original);
    expect(createImageBitmap).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
    expect(shrunk).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    expect(close).toHaveBeenCalled();
  });

  it("takes a longer edge when asked, as listing photos do", async () => {
    decodes(4000, 3000);
    await shrinkPhoto(original, 2560);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
  });

  it("does not enlarge a small photo", async () => {
    decodes(900, 1200);
    await shrinkPhoto(original);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 900, 1200);
  });

  it("sends the file as it is when the browser cannot decode or encode it", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("unsupported"))));
    expect(await shrinkPhoto(original)).toBe(original);
    decodes(4000, 3000);
    blob = null;
    expect(await shrinkPhoto(original)).toBe(original);
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(await shrinkPhoto(original)).toBe(original);
  });
});

describe("withShrunkPhoto", () => {
  it("replaces a chosen photo and leaves a form without one alone", async () => {
    decodes(4000, 3000);
    const form = new FormData();
    form.set("bio", "Hi");
    form.set("photo", new File([], ""));
    expect((await withShrunkPhoto(form)).get("photo")).toMatchObject({ size: 0 });
    form.delete("photo");
    expect((await withShrunkPhoto(form)).has("photo")).toBe(false);
    form.set("photo", original);
    expect((await withShrunkPhoto(form)).get("photo")).toMatchObject({ name: "photo.jpg" });
    expect(createImageBitmap).toHaveBeenCalledOnce();
  });
});
