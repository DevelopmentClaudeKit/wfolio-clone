"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

const SignUp = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(100),
  email: z.string().trim().toLowerCase().email("Неверный email"),
  password: z.string().min(8, "Пароль: минимум 8 символов").max(200),
});

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { error: "Этот email уже зарегистрирован" };
  const [user] = await db
    .insert(schema.users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Неверный email или пароль" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logOut() {
  await destroySession();
  redirect("/");
}
