"use client";

import { useActionState } from "react";
import { unlockGallery } from "@/actions/gallery";

export function PasswordGate({ slug, title, theme }: { slug: string; title: string; theme: "light" | "dark" }) {
  const [state, action, pending] = useActionState(unlockGallery.bind(null, slug), undefined);
  const dark = theme === "dark";
  return (
    <main className={`flex flex-1 items-center justify-center px-4 ${dark ? "bg-neutral-950 text-white" : "bg-white"}`}>
      <form action={action} className="w-full max-w-xs space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] opacity-60">Галерея защищена паролем</p>
        <h1 className="text-2xl font-light">{title}</h1>
        <input className="input text-center" name="password" type="password" placeholder="Пароль" required autoFocus />
        {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>Открыть</button>
      </form>
    </main>
  );
}
