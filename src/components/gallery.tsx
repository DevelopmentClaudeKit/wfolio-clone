"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { startFavorites, submitFavorites, toggleFavorite } from "@/actions/gallery";

type GalleryFile = { id: string; name: string; folderId: string | null; width: number | null; height: number | null };

export function Gallery(props: {
  slug: string;
  title: string;
  description: string;
  theme: "light" | "dark";
  coverFileId: string | null;
  downloadsEnabled: boolean;
  favoritesEnabled: boolean;
  favoritesLimit: number | null;
  folders: { id: string; name: string }[];
  files: GalleryFile[];
  hasList: boolean;
  initialFavorites: string[];
  submitted: boolean;
}) {
  const { slug, files, folders, favoritesEnabled, downloadsEnabled, favoritesLimit } = props;
  const dark = props.theme === "dark";
  const [folder, setFolder] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => new Set(props.initialFavorites));
  const [hasList, setHasList] = useState(props.hasList);
  const [askName, setAskName] = useState<string | null>(null); // file waiting to be favorited
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(props.submitted);

  const tabs = [
    { id: null as string | null, name: "Все фото" },
    ...folders.filter((f) => files.some((x) => x.folderId === f.id)),
  ];
  const activeFolder = tabs.some((t) => t.id === folder) ? folder : null;

  const visible = useMemo(() => {
    if (onlyFavorites) return files.filter((f) => favorites.has(f.id));
    if (activeFolder === null) return files;
    return files.filter((f) => f.folderId === activeFolder);
  }, [onlyFavorites, files, favorites, activeFolder]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggle = useCallback(
    async (fileId: string) => {
      if (!hasList) {
        setAskName(fileId);
        return;
      }
      const on = !favorites.has(fileId);
      setFavorites((s) => {
        const next = new Set(s);
        if (on) next.add(fileId);
        else next.delete(fileId);
        return next;
      });
      const res = await toggleFavorite(slug, fileId, on);
      if (res.error) {
        flash(res.error);
        setFavorites((s) => {
          const next = new Set(s);
          if (on) next.delete(fileId);
          else next.add(fileId);
          return next;
        });
      } else {
        setSubmitted(false);
      }
    },
    [favorites, hasList, slug],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : Math.min(visible.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, visible.length]);

  const current = lightbox !== null ? visible[lightbox] : null;
  const muted = dark ? "text-neutral-400" : "text-neutral-500";

  return (
    <div className={`flex-1 ${dark ? "bg-neutral-950 text-neutral-100" : "bg-white text-neutral-900"}`}>
      <header className="relative flex h-[85vh] min-h-[420px] items-end justify-center overflow-hidden bg-neutral-900">
        {props.coverFileId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${props.coverFileId}/web`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="relative mb-16 px-4 text-center text-white">
          <h1 className="text-4xl font-light tracking-wide sm:text-6xl">{props.title}</h1>
          {props.description && <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-white/80">{props.description}</p>}
          <a href="#photos" className="mt-8 inline-block border border-white/70 px-6 py-2 text-xs uppercase tracking-[0.25em] hover:bg-white hover:text-black">
            Смотреть
          </a>
        </div>
      </header>

      <nav
        id="photos"
        className={`sticky top-0 z-20 border-b backdrop-blur ${dark ? "border-neutral-800 bg-neutral-950/90" : "border-neutral-200 bg-white/90"}`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          <span className="font-medium">{props.title}</span>
          <div className="flex flex-wrap gap-4">
            {tabs.length > 1 &&
              tabs.map((t) => (
                <button
                  key={t.id ?? "all"}
                  onClick={() => {
                    setFolder(t.id);
                    setOnlyFavorites(false);
                  }}
                  className={!onlyFavorites && activeFolder === t.id ? "underline underline-offset-4" : muted}
                >
                  {t.name}
                </button>
              ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            {favoritesEnabled && (
              <button onClick={() => setOnlyFavorites((v) => !v)} className={onlyFavorites ? "underline underline-offset-4" : muted}>
                ♥ Избранное {favorites.size > 0 && `(${favorites.size}${favoritesLimit ? `/${favoritesLimit}` : ""})`}
              </button>
            )}
            {favoritesEnabled && favorites.size > 0 && (
              <button
                className={`rounded px-3 py-1.5 ${dark ? "bg-white text-black" : "bg-neutral-900 text-white"}`}
                onClick={async () => {
                  const res = await submitFavorites(slug);
                  if (res.error) flash(res.error);
                  else {
                    setSubmitted(true);
                    flash("Выбор отправлен фотографу");
                  }
                }}
              >
                {submitted ? "Отправлено ✓" : "Отправить выбор"}
              </button>
            )}
            {downloadsEnabled && (
              <a
                href={`/api/g/${slug}/zip${!onlyFavorites && activeFolder ? `?folder=${activeFolder}` : ""}`}
                className={muted + " hover:underline"}
              >
                Скачать {activeFolder && !onlyFavorites ? "папку" : "всё"}
              </a>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-2 py-6 sm:px-4">
        {visible.length === 0 ? (
          <p className={`py-24 text-center text-sm ${muted}`}>
            {onlyFavorites ? "Вы ещё не отметили ни одного фото." : "Здесь пока нет фото."}
          </p>
        ) : (
          <ul className="columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4">
            {visible.map((file, i) => (
              <li key={file.id} className="group relative mb-2 break-inside-avoid sm:mb-3">
                <button onClick={() => setLightbox(i)} className="block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${file.id}/thumb`}
                    alt={file.name}
                    loading="lazy"
                    width={file.width ?? undefined}
                    height={file.height ?? undefined}
                    className="h-auto w-full bg-neutral-500/10"
                  />
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  {favoritesEnabled && (
                    <IconButton label="В избранное" onClick={() => toggle(file.id)} active={favorites.has(file.id)}>
                      ♥
                    </IconButton>
                  )}
                  {downloadsEnabled && (
                    <IconButton label="Скачать" href={`/api/files/${file.id}/original`}>↓</IconButton>
                  )}
                </div>
                {favorites.has(file.id) && (
                  <span className="pointer-events-none absolute left-2 top-2 text-lg text-white drop-shadow group-hover:opacity-0">♥</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {current && lightbox !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-4 p-3 text-sm">
            <span className="truncate text-white/60">
              {lightbox + 1} / {visible.length}
            </span>
            <div className="flex items-center gap-2">
              {favoritesEnabled && (
                <IconButton label="В избранное" onClick={() => toggle(current.id)} active={favorites.has(current.id)}>♥</IconButton>
              )}
              {downloadsEnabled && <IconButton label="Скачать" href={`/api/files/${current.id}/original`}>↓</IconButton>}
              <IconButton label="Закрыть" onClick={() => setLightbox(null)}>✕</IconButton>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={current.id} src={`/api/files/${current.id}/web`} alt={current.name} className="max-h-full max-w-full object-contain" />
            {lightbox > 0 && (
              <button aria-label="Назад" onClick={() => setLightbox(lightbox - 1)} className="absolute inset-y-0 left-0 w-1/4 text-left text-3xl text-white/50 hover:text-white sm:w-16 sm:text-center">
                ‹
              </button>
            )}
            {lightbox < visible.length - 1 && (
              <button aria-label="Вперёд" onClick={() => setLightbox(lightbox + 1)} className="absolute inset-y-0 right-0 w-1/4 text-right text-3xl text-white/50 hover:text-white sm:w-16 sm:text-center">
                ›
              </button>
            )}
          </div>
        </div>
      )}

      {askName && (
        <NameDialog
          dark={dark}
          onCancel={() => setAskName(null)}
          onSubmit={async (name, email) => {
            const res = await startFavorites(slug, { name, email });
            if ("error" in res && res.error) return res.error;
            setHasList(true);
            const fileId = askName;
            setAskName(null);
            setFavorites((s) => new Set(s).add(fileId));
            const t = await toggleFavorite(slug, fileId, true);
            if (t.error) {
              flash(t.error);
              setFavorites((s) => {
                const next = new Set(s);
                next.delete(fileId);
                return next;
              });
            }
            return null;
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  href,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const cls = `pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-base shadow transition ${
    active ? "bg-white text-red-500" : "bg-black/50 text-white hover:bg-black/70"
  }`;
  return href ? (
    <a href={href} aria-label={label} title={label} className={cls}>{children}</a>
  ) : (
    <button onClick={onClick} aria-label={label} title={label} className={cls}>{children}</button>
  );
}

function NameDialog({
  dark,
  onSubmit,
  onCancel,
}: {
  dark: boolean;
  onSubmit: (name: string, email: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          setError(await onSubmit(String(form.get("name")), String(form.get("email") ?? "")));
          setPending(false);
        }}
        className={`w-full max-w-sm space-y-4 rounded-lg p-6 ${dark ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`}
      >
        <h2 className="text-lg font-medium">Как вас зовут?</h2>
        <p className={`text-sm ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
          Фотограф увидит ваш выбор под этим именем.
        </p>
        <input className="input" name="name" placeholder="Имя" required autoFocus />
        <input className="input" name="email" type="email" placeholder="Email (необязательно)" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="btn-primary" disabled={pending}>Продолжить</button>
        </div>
      </form>
    </div>
  );
}
