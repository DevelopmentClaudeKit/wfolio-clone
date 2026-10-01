"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/actions/auth";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <Link href="/" className="block text-lg font-semibold tracking-tight">wfolio·clone</Link>
        <h1 className="text-2xl font-semibold">{signup ? "Регистрация" : "Вход"}</h1>
        {signup && (
          <div>
            <label className="label" htmlFor="name">Имя</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Пароль</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {signup ? "Создать аккаунт" : "Войти"}
        </button>
        <p className="text-sm text-neutral-600">
          {signup ? (
            <>Уже есть аккаунт? <Link className="underline" href="/login">Войти</Link></>
          ) : (
            <>Нет аккаунта? <Link className="underline" href="/signup">Зарегистрироваться</Link></>
          )}
        </p>
      </form>
    </main>
  );
}
