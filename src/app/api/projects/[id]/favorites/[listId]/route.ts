import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { contentDisposition } from "@/lib/storage";

/** Exports a client's favorites list as CSV. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/favorites/[listId]">) {
  const user = await getCurrentUser();
  const { id, listId } = await ctx.params;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [row] = await db
    .select({ list: schema.favoriteLists, project: schema.projects })
    .from(schema.favoriteLists)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.favoriteLists.projectId))
    .where(and(eq(schema.favoriteLists.id, listId), eq(schema.projects.id, id), eq(schema.projects.userId, user.id)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const items = await db
    .select({ file: schema.files, folder: schema.folders })
    .from(schema.favoriteItems)
    .innerJoin(schema.files, eq(schema.files.id, schema.favoriteItems.fileId))
    .leftJoin(schema.folders, eq(schema.folders.id, schema.files.folderId))
    .where(eq(schema.favoriteItems.listId, listId))
    .orderBy(asc(schema.files.position), asc(schema.files.originalName));

  const csv = toCsv([
    ["file_name", "folder", "width", "height", "size_bytes"],
    ...items.map(({ file, folder }) => [
      file.originalName,
      folder?.name ?? "",
      String(file.width ?? ""),
      String(file.height ?? ""),
      String(file.sizeBytes),
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(`${slugify(row.project.title)}-${slugify(row.list.clientName)}.csv`),
    },
  });
}
