import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { contentDisposition, isLocalStorage, localStorageDriver, verifyLocal } from "@/lib/storage";

// Serves signed reads and uploads for the "local" storage driver (development only).

function checkSignature(url: URL, op: "get" | "put") {
  if (!isLocalStorage()) return null;
  const params = Object.fromEntries(url.searchParams);
  const { sig, ...signed } = params;
  if (signed.op !== op || !sig || !verifyLocal(signed, sig)) return null;
  return signed;
}

export async function GET(req: Request) {
  const params = checkSignature(new URL(req.url), "get");
  if (!params) return new Response("Forbidden", { status: 403 });
  const driver = localStorageDriver();
  const size = await driver.size(params.key);
  if (size === null) return new Response("Not found", { status: 404 });
  const stream = await driver.getStream(params.key);
  const headers: Record<string, string> = {
    "Content-Length": String(size),
    "Content-Type": params.ct ?? (params.key.endsWith(".webp") ? "image/webp" : "application/octet-stream"),
    "Cache-Control": "private, max-age=3600",
  };
  if (params.dl) headers["Content-Disposition"] = contentDisposition(params.dl);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}

export async function PUT(req: Request) {
  const params = checkSignature(new URL(req.url), "put");
  if (!params || !req.body) return new Response("Forbidden", { status: 403 });
  const target = localStorageDriver().pathFor(params.key);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(req.body as WebReadableStream), createWriteStream(target));
  return new Response(null, { status: 200 });
}
