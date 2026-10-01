"use client";

import { useActionState } from "react";
import { createProject } from "@/actions/projects";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input className="input sm:w-80" name="title" placeholder="Название съёмки, например «Свадьба Анны и Ильи»" required />
      <button className="btn-primary" disabled={pending}>Новая галерея</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
