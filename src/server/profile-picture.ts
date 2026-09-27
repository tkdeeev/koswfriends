import sharp from "sharp";
import { AppError } from "./security";

export const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

/** Bound the stream too: Content-Length can be absent or dishonest. */
export async function readPicture(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_PICTURE_BYTES)
    throw new AppError("picture_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("picture_invalid");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PICTURE_BYTES) {
        await reader.cancel();
        throw new AppError("picture_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function normalizePicture(input: Buffer) {
  try {
    if (!input.length || input.length > MAX_PICTURE_BYTES)
      throw new Error("size");
    // Check magic bytes before giving any data to vector/document decoders.
    const raster =
      input.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
      input
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (input.toString("ascii", 0, 4) === "RIFF" &&
        input.toString("ascii", 8, 12) === "WEBP");
    if (!raster) throw new Error("format");
    const image = sharp(input, {
      limitInputPixels: 50_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages || 1) > 1
    )
      throw new Error("format");
    // Auto-orient before cropping; default output strips EXIF/GPS and other metadata.
    return await image
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .timeout({ seconds: 10 })
      .toBuffer();
  } catch {
    throw new AppError("picture_invalid", 400);
  }
}
