"use client";

import { useActionState } from "react";
import { deleteProject, updateProjectSettings } from "@/actions/projects";
import type { Project } from "@/db/schema";

export function SettingsForm({ project }: { project: Project }) {
  const [state, action, pending] = useActionState(updateProjectSettings.bind(null, project.id), undefined);
  return (
    <div className="max-w-xl space-y-10">
      <form action={action} className="space-y-5">
        <div>
          <label className="label" htmlFor="title">Название</label>
          <input className="input" id="title" name="title" defaultValue={project.title} required />
        </div>
        <div>
          <label className="label" htmlFor="slug">Адрес галереи</label>
          <div className="flex items-center gap-1 text-sm text-neutral-500">
            <span>/g/</span>
            <input className="input" id="slug" name="slug" defaultValue={project.slug} required pattern="[a-z0-9-]+" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Описание</label>
          <textarea className="input min-h-24" id="description" name="description" defaultValue={project.description} />
        </div>
        <fieldset>
          <legend className="label">Тема</legend>
          <div className="flex gap-4 text-sm">
            {(["light", "dark"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2">
                <input type="radio" name="theme" value={t} defaultChecked={project.theme === t} />
                {t === "light" ? "Светлая" : "Тёмная"}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="password">
            Пароль {project.passwordHash ? "(установлен, введите новый, чтобы сменить)" : "(не установлен)"}
          </label>
          <input className="input" id="password" name="password" type="text" autoComplete="off" placeholder="Без пароля галерея открыта по ссылке" />
          {project.passwordHash && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="removePassword" /> Убрать пароль
            </label>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="downloadsEnabled" defaultChecked={project.downloadsEnabled} />
          Разрешить клиентам скачивать фото
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="favoritesEnabled" defaultChecked={project.favoritesEnabled} />
            Разрешить клиентам выбирать избранное
          </label>
          <div className="flex items-center gap-2 pl-6 text-sm">
            <span>Лимит:</span>
            <input
              className="input w-24"
              name="favoritesLimit"
              type="number"
              min={1}
              defaultValue={project.favoritesLimit ?? ""}
              placeholder="нет"
            />
            <span className="text-neutral-500">фото</span>
          </div>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        <button className="btn-primary" disabled={pending}>Сохранить</button>
      </form>

      <form
        action={deleteProject.bind(null, project.id)}
        onSubmit={(e) => {
          if (!confirm("Удалить галерею вместе со всеми фото? Это нельзя отменить.")) e.preventDefault();
        }}
        className="border-t border-neutral-200 pt-6"
      >
        <button className="btn-danger">Удалить галерею</button>
      </form>
    </div>
  );
}
