import "server-only";
import sharp from "sharp";
import type { FileRow } from "@/db/schema";
import { fileKeys, storage } from "./storage";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/tiff"];

/** Generates the grid thumbnail and the lightbox-sized web version of an uploaded original. */
export async function processImage(file: Pick<FileRow, "id" | "projectId">, userId: string) {
  const keys = fileKeys(userId, file.projectId, file.id);
  const original = await storage().getBuffer(keys.original);
  const image = sharp(original, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const [thumb, web] = await Promise.all([
    image.clone().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
    image.clone().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
  ]);
  await Promise.all([
    storage().put(keys.thumb, thumb, "image/webp"),
    storage().put(keys.web, web, "image/webp"),
  ]);
  // EXIF orientations 5-8 swap width and height.
  const swapped = (meta.orientation ?? 1) >= 5;
  return {
    width: (swapped ? meta.height : meta.width) ?? null,
    height: (swapped ? meta.width : meta.height) ?? null,
  };
}
