import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Project } from "@/db/schema";
import { appSecret } from "./env";

const cookieName = (projectId: string) => `g_${projectId.replace(/-/g, "")}`;

// The token is bound to the current password hash, so changing the password revokes old access.
function accessToken(project: Pick<Project, "id" | "passwordHash">) {
  return createHmac("sha256", appSecret())
    .update(`${project.id}:${project.passwordHash ?? ""}`)
    .digest("base64url");
}

export async function grantGalleryAccess(project: Pick<Project, "id" | "passwordHash">) {
  (await cookies()).set(cookieName(project.id), accessToken(project), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function hasGalleryAccess(project: Pick<Project, "id" | "passwordHash">) {
  if (!project.passwordHash) return true;
  const value = (await cookies()).get(cookieName(project.id))?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(accessToken(project));
  return a.length === b.length && timingSafeEqual(a, b);
}

const listCookie = (projectId: string) => `fav_${projectId.replace(/-/g, "")}`;

export async function getClientListId(projectId: string) {
  return (await cookies()).get(listCookie(projectId))?.value ?? null;
}

export async function setClientListId(projectId: string, listId: string) {
  (await cookies()).set(listCookie(projectId), listId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
  });
}
