"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { getOwnedProject } from "@/lib/projects";
import { isValidSlug, slugify } from "@/lib/slug";
import { fileKeys, storage } from "@/lib/storage";
import type { FormState } from "./auth";

async function uniqueSlug(base: string, exceptProjectId?: string) {
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 55)}-${i}`;
    const taken = await db.query.projects.findFirst({
      where: exceptProjectId
        ? and(eq(schema.projects.slug, candidate), ne(schema.projects.id, exceptProjectId))
        : eq(schema.projects.slug, candidate),
    });
    if (!taken) return candidate;
  }
}

export async function createProject(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "Введите название съёмки" };
  const [project] = await db
    .insert(schema.projects)
    .values({ userId: user.id, title: title.slice(0, 200), slug: await uniqueSlug(slugify(title)) })
    .returning();
  redirect(`/dashboard/projects/${project.id}`);
}

const Settings = z.object({
  title: z.string().trim().min(1, "Введите название").max(200),
  slug: z.string().trim().toLowerCase(),
  description: z.string().max(5000).default(""),
  theme: z.enum(["light", "dark"]),
  password: z.string().max(200).default(""),
  removePassword: z.string().optional(),
  downloadsEnabled: z.string().optional(),
  favoritesEnabled: z.string().optional(),
  favoritesLimit: z.string().default(""),
});

export async function updateProjectSettings(projectId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  const parsed = Settings.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = parsed.data;
  if (!isValidSlug(s.slug)) return { error: "Адрес: только латиница, цифры и дефис" };
  if ((await uniqueSlug(s.slug, project.id)) !== s.slug) return { error: "Этот адрес уже занят" };
  const limit = s.favoritesLimit.trim() === "" ? null : Number(s.favoritesLimit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 100000)) {
    return { error: "Лимит избранного: целое число от 1" };
  }

  let passwordHash = project.passwordHash;
  if (s.removePassword) passwordHash = null;
  else if (s.password) passwordHash = await hashPassword(s.password);

  await db
    .update(schema.projects)
    .set({
      title: s.title,
      slug: s.slug,
      description: s.description,
      theme: s.theme,
      passwordHash,
      downloadsEnabled: !!s.downloadsEnabled,
      favoritesEnabled: !!s.favoritesEnabled,
      favoritesLimit: limit,
    })
    .where(eq(schema.projects.id, project.id));
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { ok: "Сохранено" };
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  const files = await db.query.files.findMany({ where: eq(schema.files.projectId, project.id) });
  await storage().deleteMany(files.flatMap((f) => Object.values(fileKeys(user.id, project.id, f.id))));
  await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
  redirect("/dashboard");
}

export async function createFolder(projectId: string, form: FormData) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name) return;
  const existing = await db.query.folders.findMany({ where: eq(schema.folders.projectId, project.id) });
  await db.insert(schema.folders).values({ projectId: project.id, name, position: existing.length });
  revalidatePath(`/dashboard/projects/${project.id}`);
}

export async function renameFolder(projectId: string, folderId: string, name: string) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return;
  await db
    .update(schema.folders)
    .set({ name: trimmed })
    .where(and(eq(schema.folders.id, folderId), eq(schema.folders.projectId, project.id)));
  revalidatePath(`/dashboard/projects/${project.id}`);
}

/** Deletes the folder; its photos move to the gallery root. */
export async function deleteFolder(projectId: string, folderId: string) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  await db
    .delete(schema.folders)
    .where(and(eq(schema.folders.id, folderId), eq(schema.folders.projectId, project.id)));
  revalidatePath(`/dashboard/projects/${project.id}`);
}

export async function deleteFiles(projectId: string, fileIds: string[]) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (fileIds.length === 0) return;
  const files = await db.query.files.findMany({
    where: and(eq(schema.files.projectId, project.id), inArray(schema.files.id, fileIds)),
  });
  await storage().deleteMany(files.flatMap((f) => Object.values(fileKeys(user.id, project.id, f.id))));
  await db.delete(schema.files).where(inArray(schema.files.id, files.map((f) => f.id)));
  if (project.coverFileId && files.some((f) => f.id === project.coverFileId)) {
    await db.update(schema.projects).set({ coverFileId: null }).where(eq(schema.projects.id, project.id));
  }
  revalidatePath(`/dashboard/projects/${project.id}`);
}

export async function moveFiles(projectId: string, fileIds: string[], folderId: string | null) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  if (folderId) {
    const folder = await db.query.folders.findFirst({ where: eq(schema.folders.id, folderId) });
    if (folder?.projectId !== project.id) return;
  }
  await db
    .update(schema.files)
    .set({ folderId })
    .where(and(eq(schema.files.projectId, project.id), inArray(schema.files.id, fileIds)));
  revalidatePath(`/dashboard/projects/${project.id}`);
}

export async function setCover(projectId: string, fileId: string) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.projectId, project.id)),
  });
  if (!file) return;
  await db.update(schema.projects).set({ coverFileId: file.id }).where(eq(schema.projects.id, project.id));
  revalidatePath(`/dashboard/projects/${project.id}`);
}

export async function deleteFavoriteList(projectId: string, listId: string) {
  const user = await requireUser();
  const project = await getOwnedProject(user.id, projectId);
  await db
    .delete(schema.favoriteLists)
    .where(and(eq(schema.favoriteLists.id, listId), eq(schema.favoriteLists.projectId, project.id)));
  revalidatePath(`/dashboard/projects/${project.id}`);
}
