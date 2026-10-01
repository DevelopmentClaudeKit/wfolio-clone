"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifyPassword } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { getClientListId, grantGalleryAccess, hasGalleryAccess, setClientListId } from "@/lib/gallery-access";
import { sendMail } from "@/lib/mail";
import type { FormState } from "./auth";

async function projectBySlug(slug: string) {
  return db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });
}

export async function unlockGallery(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const project = await projectBySlug(slug);
  if (!project?.passwordHash) return { error: "Галерея не найдена" };
  if (!(await verifyPassword(String(form.get("password") ?? ""), project.passwordHash))) {
    return { error: "Неверный пароль" };
  }
  await grantGalleryAccess(project);
  revalidatePath(`/g/${slug}`);
  return { ok: "ok" };
}

/** Loads the gallery and the visitor's favorites list, checking access. */
async function clientContext(slug: string) {
  const project = await projectBySlug(slug);
  if (!project || !project.favoritesEnabled || !(await hasGalleryAccess(project))) return null;
  const listId = await getClientListId(project.id);
  const list = listId
    ? await db.query.favoriteLists.findFirst({
        where: and(eq(schema.favoriteLists.id, listId), eq(schema.favoriteLists.projectId, project.id)),
      })
    : null;
  return { project, list: list ?? null };
}

const Client = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(100),
  email: z.union([z.literal(""), z.string().trim().email("Неверный email")]).default(""),
});

export async function startFavorites(slug: string, input: { name: string; email: string }) {
  const ctx = await clientContext(slug);
  if (!ctx) return { error: "Избранное недоступно" };
  const parsed = Client.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (ctx.list) return { listId: ctx.list.id };
  const [list] = await db
    .insert(schema.favoriteLists)
    .values({ projectId: ctx.project.id, clientName: parsed.data.name, clientEmail: parsed.data.email })
    .returning();
  await setClientListId(ctx.project.id, list.id);
  return { listId: list.id };
}

export async function toggleFavorite(slug: string, fileId: string, on: boolean) {
  const ctx = await clientContext(slug);
  if (!ctx?.list) return { error: "Сначала представьтесь" };
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.projectId, ctx.project.id)),
  });
  if (!file) return { error: "Фото не найдено" };

  if (on) {
    const limit = ctx.project.favoritesLimit;
    if (limit) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(schema.favoriteItems)
        .where(eq(schema.favoriteItems.listId, ctx.list.id));
      if (n >= limit) return { error: `Можно выбрать не больше ${limit} фото` };
    }
    await db.insert(schema.favoriteItems).values({ listId: ctx.list.id, fileId }).onConflictDoNothing();
  } else {
    await db
      .delete(schema.favoriteItems)
      .where(and(eq(schema.favoriteItems.listId, ctx.list.id), eq(schema.favoriteItems.fileId, fileId)));
  }
  return { ok: true };
}

export async function submitFavorites(slug: string) {
  const ctx = await clientContext(slug);
  if (!ctx?.list) return { error: "Список пуст" };
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.favoriteItems)
    .where(eq(schema.favoriteItems.listId, ctx.list.id));
  if (n === 0) return { error: "Список пуст" };
  await db
    .update(schema.favoriteLists)
    .set({ submittedAt: new Date() })
    .where(eq(schema.favoriteLists.id, ctx.list.id));

  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, ctx.project.userId) });
  if (owner) {
        await sendMail(
      owner.email,
      `${ctx.list.clientName} выбрал(а) ${n} фото в «${ctx.project.title}»`,
      `${ctx.list.clientName}${ctx.list.clientEmail ? ` (${ctx.list.clientEmail})` : ""} отправил(а) избранное: ${n} фото.\n\n` +
        `Открыть: ${appUrl()}/dashboard/projects/${ctx.project.id}?tab=favorites`,
    ).catch((err) => console.error("sendMail failed", err));
  }
  return { ok: true, count: n };
}
