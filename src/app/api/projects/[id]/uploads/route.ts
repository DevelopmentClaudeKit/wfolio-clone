import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { IMAGE_TYPES } from "@/lib/images";
import { storageUsed } from "@/lib/projects";
import { fileKeys, storage } from "@/lib/storage";

const Body = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(25 * 1024 ** 3),
  type: z.string(),
  folderId: z.string().uuid().nullable().optional(),
});

/** Registers a pending file and returns a URL the browser uploads the original to. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/uploads">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Нужно войти" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!project || project.userId !== user.id) {
    return Response.json({ error: "Проект не найден" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Неверный запрос" }, { status: 400 });
  const { name, size, type, folderId } = parsed.data;
  if (!IMAGE_TYPES.includes(type)) {
    return Response.json({ error: `${name}: пока поддерживаются только фото (JPEG, PNG, WebP, HEIC, TIFF)` }, { status: 415 });
  }
  if (folderId) {
    const folder = await db.query.folders.findFirst({ where: eq(schema.folders.id, folderId) });
    if (folder?.projectId !== project.id) return Response.json({ error: "Папка не найдена" }, { status: 404 });
  }
  if ((await storageUsed(user.id)) + size > user.storageQuotaBytes) {
    return Response.json({ error: "Хранилище заполнено" }, { status: 413 });
  }

  const [file] = await db
    .insert(schema.files)
    .values({
      projectId: project.id,
      folderId: folderId ?? null,
      originalName: name,
      storageKey: "",
      mime: type,
      sizeBytes: size,
      position: sql`(select coalesce(max(position), 0) + 1 from files where project_id = ${project.id})`,
    })
    .returning();
  const key = fileKeys(user.id, project.id, file.id).original;
  await db.update(schema.files).set({ storageKey: key }).where(eq(schema.files.id, file.id));

  return Response.json({ fileId: file.id, uploadUrl: await storage().uploadUrl(key, type) });
}
