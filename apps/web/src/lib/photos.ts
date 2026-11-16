import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from "@mteam/shared";
import sharp from "sharp";
import { z } from "zod";

/** A photo ready to store: always WebP, with a small copy for cards and previews. */
export interface Photo {
  bytes: Uint8Array<ArrayBuffer>;
  thumb: Uint8Array<ArrayBuffer>;
  type: "image/webp";
  ext: "webp";
}

/** Recognised by file content, because the name and type a browser sends can be anything. Only these are decoded at all. */
const signatures = [
  [[0, "\xff\xd8\xff"]],
  [[0, "\x89PNG\r\n\x1a\n"]],
  [
    [0, "RIFF"],
    [8, "WEBP"],
  ],
] as const;

function isKnownFormat(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 12)).toString("latin1");
  return signatures.some((marks) => marks.every(([offset, mark]) => head.startsWith(mark, offset)));
}

/** A few megabytes of compressed image can decode to far more memory than the file suggests. Phone cameras stay below this. */
const MAX_INPUT_PIXELS = 50_000_000;

/** Sharp on a full-screen view yet small. Effort 4 keeps sixteen photos well inside a function's time. */
const MAIN = { edge: 2048, quality: 80 };
const THUMB = { edge: 640, quality: 75 };

// ponytail: one queue per process, so memory stays bounded while posts wait their turn. Add per-user limits if posting volume needs them.
let queue: Promise<unknown> = Promise.resolve();

/** Runs jobs one after another. A small file can decode to hundreds of megabytes, so parallel posts must not decode together. */
export function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Re-encoded as WebP no larger than needed, which also leaves no GPS position or other hidden field behind. The rotation those
 * fields carried is applied first, or phone photos would come out sideways. Returns null if the file does not decode as an image.
 */
async function encode(bytes: Uint8Array): Promise<Pick<Photo, "bytes" | "thumb"> | null> {
  try {
    // failOn "error": a browser shows a photo with a minor flaw without complaint, so it should not be refused here.
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const sized = ({ edge, quality }: typeof MAIN) =>
      image.clone().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer();
    const [main, thumb] = await oneAtATime(() => Promise.all([sized(MAIN), sized(THUMB)]));
    return { bytes: new Uint8Array(main), thumb: new Uint8Array(thumb) };
  } catch {
    return null;
  }
}

/** Returns the photos ready to upload, or null if the set breaks a limit or holds a non-image. */
export async function readPhotos(files: File[]): Promise<Photo[] | null> {
  if (files.length < 1 || files.length > MAX_PHOTOS || files.some((file) => file.size > MAX_PHOTO_BYTES)) return null;
  const photos: Photo[] = [];
  for (const file of files) {
    const original = new Uint8Array(await file.arrayBuffer());
    if (!isKnownFormat(original)) return null;
    const encoded = await encode(original);
    if (!encoded) return null;
    photos.push({ ...encoded, type: "image/webp", ext: "webp" });
  }
  return photos;
}

const storageEnvSchema = z.object({
  STORAGE_ENDPOINT: z.url(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_PUBLIC_URL: z.url(),
});

/**
 * Stores a photo and its small copy in S3-compatible storage (SeaweedFS locally, R2 later) and returns the photo's public URL.
 * The copy sits next to it as `<name>_thumb.webp`, which `thumbUrl` in `@mteam/shared` works out. A name is never reused, so both cache for good.
 */
export async function uploadPhoto(photo: Photo): Promise<string> {
  const env = storageEnvSchema.parse(process.env);
  const client = new AwsClient({
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const name = `listings/${randomUUID()}`;
  const put = async (key: string, body: Uint8Array<ArrayBuffer>) => {
    const response = await client.fetch(`${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`, {
      method: "PUT",
      body,
      headers: { "content-type": photo.type, "cache-control": "public, max-age=31536000, immutable" },
    });
    if (!response.ok) throw new Error(`Photo upload failed with status ${response.status}`);
  };
  // The copy first: once the photo's URL exists, its copy should too.
  await put(`${name}_thumb.${photo.ext}`, photo.thumb);
  await put(`${name}.${photo.ext}`, photo.bytes);
  return `${env.STORAGE_PUBLIC_URL}/${name}.${photo.ext}`;
}

const uploadedKey = /^listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Whether a URL is one `uploadPhoto` could have returned, so a listing form cannot point its photos anywhere else. */
export function isUploadedPhoto(url: string): boolean {
  const prefix = `${z.object({ STORAGE_PUBLIC_URL: z.url() }).parse(process.env).STORAGE_PUBLIC_URL}/`;
  return url.startsWith(prefix) && uploadedKey.test(url.slice(prefix.length));
}
