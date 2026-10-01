import { asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { CopyButton } from "@/components/copy-button";
import { DeleteListButton } from "@/components/delete-list-button";
import { PhotoManager } from "@/components/photo-manager";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";
import { lightroomFilter } from "@/lib/format";
import { getOwnedProject, listFiles, listFolders, publicGalleryUrl } from "@/lib/projects";

const TABS = [
  ["photos", "Фото"],
  ["favorites", "Избранное"],
  ["settings", "Настройки"],
] as const;

export default async function ProjectPage(props: PageProps<"/dashboard/projects/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const tab = TABS.some(([t]) => t === rawTab) ? (rawTab as string) : "photos";
  const project = await getOwnedProject(user.id, id);
  const url = publicGalleryUrl(project);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">← Все галереи</Link>
          <h1 className="mt-1 text-2xl font-semibold">{project.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={url} label="Скопировать ссылку" />
          <a href={`/g/${project.slug}`} target="_blank" className="btn-primary py-1.5">Открыть галерею</a>
        </div>
      </div>
      <nav className="flex gap-1 border-b border-neutral-200">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key ? "border-neutral-900 font-medium" : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "photos" && (
        <PhotoManager
          projectId={project.id}
          folders={await listFolders(project.id)}
          files={await listFiles(project.id)}
          coverFileId={project.coverFileId}
        />
      )}
      {tab === "settings" && <SettingsForm project={project} />}
      {tab === "favorites" && <FavoritesTab projectId={project.id} />}
    </div>
  );
}

async function FavoritesTab({ projectId }: { projectId: string }) {
  const lists = await db.query.favoriteLists.findMany({
    where: eq(schema.favoriteLists.projectId, projectId),
    orderBy: [desc(schema.favoriteLists.submittedAt), desc(schema.favoriteLists.createdAt)],
  });
  if (lists.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-500">Клиенты ещё не выбирали фото.</p>;
  }
  const items = await db
    .select({ listId: schema.favoriteItems.listId, file: schema.files })
    .from(schema.favoriteItems)
    .innerJoin(schema.files, eq(schema.files.id, schema.favoriteItems.fileId))
    .where(inArray(schema.favoriteItems.listId, lists.map((l) => l.id)))
    .orderBy(asc(schema.files.position));

  return (
    <div className="space-y-6">
      {lists.map((list) => {
        const files = items.filter((i) => i.listId === list.id).map((i) => i.file);
        return (
          <section key={list.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">
                  {list.clientName}
                  {list.clientEmail && <span className="font-normal text-neutral-500"> · {list.clientEmail}</span>}
                </h2>
                <p className="text-sm text-neutral-500">
                  {files.length} фото ·{" "}
                  {list.submittedAt
                    ? `отправлено ${list.submittedAt.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}`
                    : "ещё выбирает"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={lightroomFilter(files.map((f) => f.originalName))} label="Копировать для Lightroom" />
                <a className="btn-secondary py-1.5" href={`/api/projects/${projectId}/favorites/${list.id}`}>CSV</a>
                <DeleteListButton projectId={projectId} listId={list.id} />
              </div>
            </div>
            {files.length > 0 && (
              <ul className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
                {files.map((f) => (
                  <li key={f.id} title={f.originalName}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${f.id}/thumb`} alt={f.originalName} loading="lazy" className="aspect-square w-full rounded object-cover" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
