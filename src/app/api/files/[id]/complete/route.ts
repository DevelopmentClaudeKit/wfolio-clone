import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { processImage } from "@/lib/images";
import { resolveFileAccess } from "@/lib/projects";
import { storage } from "@/lib/storage";

/** Called by the browser once the original is uploaded: checks it and builds previews. */
export async function POST(_req: Request, ctx: RouteContext<"/api/files/[id]/complete">) {
  const user = await getCurrentUser();
  const { id } = await ctx.params;
  const access = await resolveFileAccess(id);
  if (!user || !access?.isOwner) return Response.json({ error: "Не найдено" }, { status: 404 });
  const { file } = access;

  const actualSize = await storage().size(file.storageKey);
  if (actualSize === null) return Response.json({ error: "Файл не загружен" }, { status: 400 });

  try {
    const dims = await processImage(file, user.id);
    const [updated] = await db
      .update(schema.files)
      .set({ status: "ready", sizeBytes: actualSize, ...dims })
      .where(eq(schema.files.id, file.id))
      .returning();
    return Response.json({ file: updated });
  } catch (err) {
    console.error("processImage failed", file.id, err);
    await db.update(schema.files).set({ status: "failed", sizeBytes: actualSize }).where(eq(schema.files.id, file.id));
    return Response.json({ error: `${file.originalName}: не удалось обработать изображение` }, { status: 422 });
  }
}
