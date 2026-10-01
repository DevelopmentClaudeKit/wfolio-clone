import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Gallery } from "@/components/gallery";
import { PasswordGate } from "@/components/password-gate";
import { getClientListId, hasGalleryAccess } from "@/lib/gallery-access";
import { listFiles, listFolders } from "@/lib/projects";

const getProject = (slug: string) =>
  db.query.projects.findFirst({ where: eq(schema.projects.slug, slug) });

export async function generateMetadata(props: PageProps<"/g/[slug]">): Promise<Metadata> {
  const project = await getProject((await props.params).slug);
  return { title: project?.title ?? "Галерея", robots: { index: false } };
}

export default async function GalleryPage(props: PageProps<"/g/[slug]">) {
  const { slug } = await props.params;
  const project = await getProject(slug);
  if (!project) notFound();
  if (!(await hasGalleryAccess(project))) {
    return <PasswordGate slug={slug} title={project.title} theme={project.theme} />;
  }

  const [folders, files] = await Promise.all([listFolders(project.id), listFiles(project.id, true)]);
  const listId = await getClientListId(project.id);
  const list = listId
    ? await db.query.favoriteLists.findFirst({ where: eq(schema.favoriteLists.id, listId) })
    : null;
  const favoriteIds =
    list && list.projectId === project.id
      ? (await db.query.favoriteItems.findMany({ where: eq(schema.favoriteItems.listId, list.id) })).map((i) => i.fileId)
      : [];

  return (
    <Gallery
      slug={project.slug}
      title={project.title}
      description={project.description}
      theme={project.theme}
      coverFileId={project.coverFileId ?? files[0]?.id ?? null}
      downloadsEnabled={project.downloadsEnabled}
      favoritesEnabled={project.favoritesEnabled}
      favoritesLimit={project.favoritesLimit}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      files={files.map((f) => ({ id: f.id, name: f.originalName, folderId: f.folderId, width: f.width, height: f.height }))}
      hasList={!!list && list.projectId === project.id}
      initialFavorites={favoriteIds}
      submitted={!!list?.submittedAt}
    />
  );
}
