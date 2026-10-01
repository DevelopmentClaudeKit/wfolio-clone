import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const features = [
  ["120 ГБ бесплатно", "Хранилище для галерей клиентов без оплаты."],
  ["Красивые галереи", "Обложка, светлая или тёмная тема, сетка и просмотр на весь экран."],
  ["Отбор фото", "Клиент отмечает избранное, вы копируете список в Lightroom или CSV."],
  ["Скачивание", "По одному фото или всей галереей в ZIP. Можно выключить."],
  ["Пароль", "Закройте галерею паролем, если съёмка личная."],
  ["Папки", "Разложите съёмку по разделам: церемония, прогулка, банкет."],
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-lg font-semibold tracking-tight">wfolio·clone</span>
        <nav className="flex gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary">Мои галереи</Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">Войти</Link>
              <Link href="/signup" className="btn-primary">Начать бесплатно</Link>
            </>
          )}
        </nav>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Бесплатные галереи для фотографов</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          Отдавайте каждую съёмку красивой личной галереей вместо ссылки на файлообменник. 120 ГБ бесплатно.
        </p>
        <Link href={user ? "/dashboard" : "/signup"} className="btn-primary mt-10 px-6 py-3 text-base">
          Создать галерею
        </Link>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, text]) => (
          <div key={title} className="rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-neutral-600">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
