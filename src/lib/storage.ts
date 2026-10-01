import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage. "s3" works with AWS S3, Cloudflare R2, MinIO and other S3-compatible services;
 * "local" keeps files on disk and serves them through /api/local-storage (development only).
 */
export interface Storage {
  /** URL the browser PUTs the original file to. */
  uploadUrl(key: string, contentType: string): Promise<string>;
  /** Short-lived URL to read an object; `downloadName` forces a download with that file name. */
  readUrl(key: string, opts?: { downloadName?: string; contentType?: string }): Promise<string>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  getBuffer(key: string): Promise<Buffer>;
  getStream(key: string): Promise<Readable>;
  size(key: string): Promise<number | null>;
  deleteMany(keys: string[]): Promise<void>;
}

const URL_TTL_SECONDS = 60 * 60;

export function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  private bucket = process.env.S3_BUCKET ?? "wfolio";

  uploadUrl(key: string, contentType: string) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: URL_TTL_SECONDS },
    );
  }

  readUrl(key: string, opts: { downloadName?: string; contentType?: string } = {}) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.downloadName
          ? contentDisposition(opts.downloadName)
          : undefined,
        ResponseContentType: opts.contentType,
      }),
      { expiresIn: URL_TTL_SECONDS },
    );
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getStream(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async getBuffer(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async size(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async deleteMany(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }
}

export function signLocal(params: Record<string, string>) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHmac("sha256", process.env.APP_SECRET ?? "dev-secret")
    .update(payload)
    .digest("base64url");
}

export function verifyLocal(params: Record<string, string>, sig: string) {
  const expected = Buffer.from(signLocal(params));
  const given = Buffer.from(sig);
  return (
    expected.length === given.length &&
    timingSafeEqual(expected, given) &&
    Number(params.exp) > Date.now() / 1000
  );
}

class LocalStorage implements Storage {
  root = path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_STORAGE_DIR ?? ".storage");

  pathFor(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }

  private signedUrl(params: Record<string, string>) {
    const exp = String(Math.floor(Date.now() / 1000) + URL_TTL_SECONDS);
    const all = { ...params, exp };
    return `/api/local-storage?${new URLSearchParams({ ...all, sig: signLocal(all) })}`;
  }

  async uploadUrl(key: string) {
    return this.signedUrl({ key, op: "put" });
  }

  async readUrl(key: string, opts: { downloadName?: string; contentType?: string } = {}) {
    const params: Record<string, string> = { key, op: "get" };
    if (opts.downloadName) params.dl = opts.downloadName;
    if (opts.contentType) params.ct = opts.contentType;
    return this.signedUrl(params);
  }

  async put(key: string, body: Buffer) {
    const p = this.pathFor(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async getBuffer(key: string) {
    return readFile(this.pathFor(key));
  }

  async getStream(key: string) {
    return createReadStream(this.pathFor(key));
  }

  async size(key: string) {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  async deleteMany(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.pathFor(k), { force: true })));
  }
}

let instance: Storage | null = null;

export function storage(): Storage {
  instance ??= process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}

export const isLocalStorage = () => process.env.STORAGE_DRIVER !== "s3";

export function localStorageDriver() {
  const s = storage();
  if (!(s instanceof LocalStorage)) throw new Error("Local storage driver is not active");
  return s;
}

export const fileKeys = (userId: string, projectId: string, fileId: string) => {
  const base = `u/${userId}/p/${projectId}/${fileId}`;
  return { original: `${base}/original`, thumb: `${base}/thumb.webp`, web: `${base}/web.webp` };
};
