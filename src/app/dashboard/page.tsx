import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { CreateProjectForm } from "@/components/create-project-form";
import { requireUser } from "@/lib/auth";
import { formatBytes } from "@/lib/format";

export const metadata = { title: "Мои галереи" };

export default async function Dashboard() {
  const user = await requireUser();
  const projects = await db
    .select({
      project: schema.projects,
      fileCount: sql<number>`(select count(*)::int from files f where f.project_id = ${schema.projects.id} and f.status = 'ready')`,
      bytes: sql<string>`(select coalesce(sum(f.size_bytes), 0) from files f where f.project_id = ${schema.projects.id})`,
      favorites: sql<number>`(select count(*)::int from favorite_lists l where l.project_id = ${schema.projects.id} and l.submitted_at is not null)`,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(desc(schema.projects.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Мои галереи</h1>
        <CreateProjectForm />
      </div>
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-600">
          Пока нет ни одной галереи. Создайте первую, чтобы загрузить съёмку.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(({ project, fileCount, bytes, favorites }) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:shadow-md"
              >
                <div className="aspect-[3/2] bg-neutral-100">
                  {project.coverFileId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${project.coverFileId}/thumb`} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-medium">{project.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {fileCount} фото · {formatBytes(Number(bytes))}
                    {favorites > 0 && ` · избранное: ${favorites}`}
                    {project.passwordHash && " · 🔒"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
