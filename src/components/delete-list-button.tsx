"use client";

import { deleteFavoriteList } from "@/actions/projects";

export function DeleteListButton({ projectId, listId }: { projectId: string; listId: string }) {
  return (
    <button
      className="text-sm text-red-600 hover:text-red-800"
      onClick={() => confirm("Удалить этот список избранного?") && deleteFavoriteList(projectId, listId)}
    >
      Удалить
    </button>
  );
}
