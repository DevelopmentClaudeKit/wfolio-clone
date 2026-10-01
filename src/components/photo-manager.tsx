"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { createFolder, deleteFiles, deleteFolder, moveFiles, renameFolder, setCover } from "@/actions/projects";
import type { FileRow, Folder } from "@/db/schema";

type Upload = { id: string; name: string; progress: number; error?: string; done?: boolean };
type View = "all" | "root" | string;

const CONCURRENCY = 3;

function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Ошибка загрузки (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Сеть недоступна"));
    xhr.send(file);
  });
}

export function PhotoManager({
  projectId,
  folders,
  files,
  coverFileId,
}: {
  projectId: string;
  folders: Folder[];
  files: FileRow[];
  coverFileId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () =>
      files.filter((f) =>
        view === "all" ? true : view === "root" ? f.folderId === null : f.folderId === view,
      ),
    [files, view],
  );
  const currentFolder = folders.find((f) => f.id === view);

  const patch = (id: string, p: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const uploadFiles = useCallback(
    async (list: File[]) => {
      const folderId = view !== "all" && view !== "root" ? view : null;
      const items = list.map((file) => ({ file, id: crypto.randomUUID() }));
      const added = items.map(({ id, file }) => ({ id, name: file.name, progress: 0 }));
      setUploads((u) => [...u, ...added]);
      const queue = [...items];

      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const { id, file } = item;
          try {
            const res = await fetch(`/api/projects/${projectId}/uploads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: file.name, size: file.size, type: file.type, folderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Ошибка");
            await putWithProgress(data.uploadUrl, file, (p) => patch(id, { progress: p * 0.9 }));
            const done = await fetch(`/api/files/${data.fileId}/complete`, { method: "POST" });
            if (!done.ok) throw new Error((await done.json()).error ?? "Ошибка обработки");
            patch(id, { progress: 1, done: true });
          } catch (err) {
            patch(id, { error: err instanceof Error ? err.message : "Ошибка" });
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      router.refresh();
    },
    [projectId, router, view],
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      setSelected(new Set());
    });

  const active = uploads.filter((u) => !u.done && !u.error).length;
  const failed = uploads.filter((u) => u.error);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-1 text-sm">
        <FolderButton active={view === "all"} onClick={() => setView("all")} label="Все фото" count={files.length} />
        <FolderButton
          active={view === "root"}
          onClick={() => setView("root")}
          label="Без папки"
          count={files.filter((f) => !f.folderId).length}
        />
        {folders.map((folder) => (
          <FolderButton
            key={folder.id}
            active={view === folder.id}
            onClick={() => setView(folder.id)}
            label={folder.name}
            count={files.filter((f) => f.folderId === folder.id).length}
          />
        ))}
        <form
          action={async (form) => {
            await createFolder(projectId, form);
            (document.getElementById("new-folder") as HTMLInputElement).value = "";
          }}
          className="flex gap-1 pt-3"
        >
          <input id="new-folder" name="name" className="input py-1.5" placeholder="Новая папка" />
          <button className="btn-secondary px-3 py-1.5">+</button>
        </form>
        {currentFolder && (
          <div className="flex gap-3 pt-2 text-xs">
            <button
              className="text-neutral-500 hover:text-neutral-900"
              onClick={() => {
                const name = prompt("Новое название папки", currentFolder.name);
                if (name) run(() => renameFolder(projectId, currentFolder.id, name));
              }}
            >
              Переименовать
            </button>
            <button
              className="text-red-600 hover:text-red-800"
              onClick={() => {
                if (confirm(`Удалить папку «${currentFolder.name}»? Фото останутся в галерее без папки.`)) {
                  run(() => deleteFolder(projectId, currentFolder.id));
                  setView("all");
                }
              }}
            >
              Удалить папку
            </button>
          </div>
        )}
      </aside>

      <section className="min-w-0 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            uploadFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center text-sm transition ${
            dragging ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 bg-white hover:border-neutral-500"
          }`}
        >
          <p className="font-medium">Перетащите фото сюда или нажмите, чтобы выбрать</p>
          <p className="mt-1 text-neutral-500">
            JPEG, PNG, WebP, HEIC, TIFF · загрузка в {currentFolder ? `папку «${currentFolder.name}»` : "галерею"}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              uploadFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {uploads.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                {active > 0
                  ? `Загружается: ${active} из ${uploads.length}`
                  : `Загружено: ${uploads.length - failed.length} из ${uploads.length}`}
              </span>
              {active === 0 && (
                <button className="text-neutral-500 hover:text-neutral-900" onClick={() => setUploads([])}>
                  Скрыть
                </button>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-200">
              <div
                className="h-full bg-neutral-900 transition-all"
                style={{ width: `${(uploads.reduce((s, u) => s + (u.error ? 1 : u.progress), 0) / uploads.length) * 100}%` }}
              />
            </div>
            {failed.map((u) => (
              <p key={u.id} className="mt-1 text-red-600">{u.name}: {u.error}</p>
            ))}
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-sm shadow">
            <span className="px-2">Выбрано: {selected.size}</span>
            <select
              className="input w-auto py-1.5"
              value=""
              disabled={pending}
              onChange={(e) => {
                const target = e.target.value === "root" ? null : e.target.value;
                run(() => moveFiles(projectId, [...selected], target));
              }}
            >
              <option value="" disabled>Переместить в…</option>
              <option value="root">Без папки</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {selected.size === 1 && (
              <button className="btn-secondary py-1.5" disabled={pending} onClick={() => run(() => setCover(projectId, [...selected][0]))}>
                Сделать обложкой
              </button>
            )}
            <button
              className="btn-danger py-1.5"
              disabled={pending}
              onClick={() => confirm(`Удалить ${selected.size} фото?`) && run(() => deleteFiles(projectId, [...selected]))}
            >
              Удалить
            </button>
            <button className="ml-auto px-2 text-neutral-500" onClick={() => setSelected(new Set())}>Снять выбор</button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Здесь пока нет фото.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {visible.map((file) => (
              <li key={file.id}>
                <button
                  onClick={() => toggle(file.id)}
                  className={`group relative block aspect-square w-full overflow-hidden rounded-md bg-neutral-200 ring-offset-2 ${
                    selected.has(file.id) ? "ring-2 ring-neutral-900" : ""
                  }`}
                  title={file.originalName}
                >
                  {file.status === "ready" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${file.id}/thumb`} alt={file.originalName} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center p-2 text-xs text-neutral-500">
                      {file.status === "failed" ? "Ошибка обработки" : "Обработка…"}
                    </span>
                  )}
                  {file.id === coverFileId && (
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Обложка</span>
                  )}
                  <span
                    className={`absolute right-1 top-1 h-5 w-5 rounded-full border-2 border-white shadow ${
                      selected.has(file.id) ? "bg-neutral-900" : "bg-black/20 opacity-0 group-hover:opacity-100"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FolderButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left ${
        active ? "bg-neutral-900 text-white" : "hover:bg-neutral-200"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={active ? "text-neutral-300" : "text-neutral-400"}>{count}</span>
    </button>
  );
}
