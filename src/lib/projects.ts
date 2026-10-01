import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { Project } from "@/db/schema";
import { getCurrentUser } from "./auth";
import { appUrl } from "./env";
import { hasGalleryAccess } from "./gallery-access";

export async function getOwnedProject(userId: string, projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  const project = await db.query.projects.findFirst({
    where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
  });
  if (!project) notFound();
  return project;
}

export async function storageUsed(userId: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.files.sizeBytes}), 0)` })
    .from(schema.files)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.files.projectId))
    .where(eq(schema.projects.userId, userId));
  return Number(row?.total ?? 0);
}

export function listFiles(projectId: string, onlyReady = false) {
  return db.query.files.findMany({
    where: onlyReady
      ? and(eq(schema.files.projectId, projectId), eq(schema.files.status, "ready"))
      : eq(schema.files.projectId, projectId),
    orderBy: [asc(schema.files.position), asc(schema.files.originalName)],
  });
}

export function listFolders(projectId: string) {
  return db.query.folders.findMany({
    where: eq(schema.folders.projectId, projectId),
    orderBy: [asc(schema.folders.position), asc(schema.folders.name)],
  });
}

/**
 * Who is looking at a file: the owner sees everything, a client needs gallery access
 * and can get originals only when downloads are enabled.
 */
export async function resolveFileAccess(fileId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const [row] = await db
    .select({ file: schema.files, project: schema.projects })
    .from(schema.files)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.files.projectId))
    .where(eq(schema.files.id, fileId))
    .limit(1);
  if (!row) return null;
  const user = await getCurrentUser();
  const isOwner = user?.id === row.project.userId;
  const canView = isOwner || (row.file.status === "ready" && (await hasGalleryAccess(row.project)));
  return {
    ...row,
    isOwner,
    canView,
    canDownload: canView && (isOwner || row.project.downloadsEnabled),
  };
}

export const publicGalleryUrl = (project: Pick<Project, "slug">) =>
  `${appUrl()}/g/${project.slug}`;
