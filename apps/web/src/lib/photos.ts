import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from "@mteam/shared";
import { z } from "zod";

export interface Photo {
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
  ext: string;
}

/** Recognised by file content, because the name and type a browser sends can be anything. */
const formats = [
  { type: "image/jpeg", ext: "jpg", marks: [[0, "\xff\xd8\xff"]] },
  { type: "image/png", ext: "png", marks: [[0, "\x89PNG\r\n\x1a\n"]] },
  { type: "image/webp", ext: "webp", marks: [[0, "RIFF"], [8, "WEBP"]] },
] as const;

function detectFormat(bytes: Uint8Array) {
  const head = Buffer.from(bytes.subarray(0, 12)).toString("latin1");
  return formats.find((format) => format.marks.every(([offset, mark]) => head.startsWith(mark, offset)));
}

/** Returns the photos ready to upload, or null if the set breaks a limit or holds a non-image. */
export async function readPhotos(files: File[]): Promise<Photo[] | null> {
  if (files.length < 1 || files.length > MAX_PHOTOS || files.some((file) => file.size > MAX_PHOTO_BYTES)) return null;
  const photos: Photo[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = detectFormat(bytes);
    if (!format) return null;
    photos.push({ bytes, type: format.type, ext: format.ext });
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

/** Stores a photo in S3-compatible storage (SeaweedFS locally, R2 later) and returns its public URL. */
export async function uploadPhoto(photo: Photo): Promise<string> {
  const env = storageEnvSchema.parse(process.env);
  const client = new AwsClient({
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const key = `listings/${randomUUID()}.${photo.ext}`;
  const response = await client.fetch(`${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`, {
    method: "PUT",
    body: photo.bytes,
    headers: { "content-type": photo.type },
  });
  if (!response.ok) throw new Error(`Photo upload failed with status ${response.status}`);
  return `${env.STORAGE_PUBLIC_URL}/${key}`;
}
