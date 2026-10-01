import { PassThrough, Readable } from "node:stream";
import archiver from "archiver";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { hasGalleryAccess } from "@/lib/gallery-access";
import { listFiles, listFolders } from "@/lib/projects";
import { slugify } from "@/lib/slug";
import { contentDisposition, storage } from "@/lib/storage";

/** Streams the originals of a gallery (or one folder, via ?folder=<id>) as a ZIP archive. */
export async function GET(req: Request, ctx: RouteContext<"/api/g/[slug]/zip">) {
  const { slug } = await ctx.params;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });
  if (!project) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  const isOwner = user?.id === project.userId;
  if (!isOwner && !(await hasGalleryAccess(project))) return new Response("Forbidden", { status: 403 });
  if (!isOwner && !project.downloadsEnabled) return new Response("Downloads are disabled", { status: 403 });

  const folderId = new URL(req.url).searchParams.get("folder");
  const folders = await listFolders(project.id);
  const folder = folderId ? folders.find((f) => f.id === folderId) : null;
  if (folderId && !folder) return new Response("Not found", { status: 404 });

  const files = folder
    ? await db.query.files.findMany({
        where: and(eq(schema.files.folderId, folder.id), eq(schema.files.status, "ready")),
      })
    : await listFiles(project.id, true);
  if (files.length === 0) return new Response("Nothing to download", { status: 404 });

  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  const archive = archiver("zip", { store: true }); // photos are already compressed
  const out = new PassThrough();
  archive.pipe(out);
  archive.on("error", (err) => out.destroy(err));

  (async () => {
    const used = new Set<string>();
    for (const file of files) {
      const dir = !folder && file.folderId ? `${folderName.get(file.folderId) ?? "folder"}/` : "";
      let name = dir + file.originalName;
      for (let i = 2; used.has(name); i++) name = dir + file.originalName.replace(/(\.[^.]*)?$/, ` (${i})$1`);
      used.add(name);
      const stream = await storage().getStream(file.storageKey);
      await new Promise<void>((resolve, reject) => {
        stream.on("end", resolve).on("error", reject);
        archive.append(stream, { name });
      });
    }
    await archive.finalize();
  })().catch((err) => archive.abort() && out.destroy(err));

  const zipName = `${slugify(folder ? `${project.title} ${folder.name}` : project.title)}.zip`;
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(zipName),
      "Cache-Control": "no-store",
    },
  });
}
