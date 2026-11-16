const LONG_EDGE = 1600;
const QUALITY = 0.9;

/**
 * A phone photo made small enough to send: the long edge at most 1600 px, as a JPEG, turned the way the camera held it.
 * In the browser only. A file the browser cannot decode goes as it is, and the server says if it is not a photo.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** The same form with its chosen photo shrunk. A form without a photo is returned untouched. */
export async function withShrunkPhoto(form: FormData, field = "photo"): Promise<FormData> {
  const file = form.get(field);
  if (file instanceof File && file.size > 0) form.set(field, await shrinkPhoto(file));
  return form;
}
