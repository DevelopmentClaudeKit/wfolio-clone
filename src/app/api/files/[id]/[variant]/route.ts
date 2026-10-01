import { resolveFileAccess } from "@/lib/projects";
import { fileKeys, storage } from "@/lib/storage";

/** Redirects to a short-lived storage URL for a file's thumbnail, web preview or original. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]/[variant]">) {
  const { id, variant } = await ctx.params;
  const access = await resolveFileAccess(id);
  if (!access?.canView) return new Response("Not found", { status: 404 });
  const { file, project } = access;
  const keys = fileKeys(project.userId, project.id, file.id);

  let url: string;
  if (variant === "thumb" || variant === "web") {
    const v: "thumb" | "web" = variant;
    url = await storage().readUrl(keys[v], { contentType: "image/webp" });
  } else if (variant === "original") {
    if (!access.canDownload) return new Response("Downloads are disabled", { status: 403 });
    url = await storage().readUrl(keys.original, { downloadName: file.originalName, contentType: file.mime });
  } else {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=600" },
  });
}
