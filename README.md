# wfolio-clone

Клон [WFolio](https://wfolio.com/ru/free-galleries): бесплатные онлайн-галереи для фотографов.

Сейчас реализован MVP «бесплатных галерей»:

- регистрация и вход фотографа (email + пароль), квота хранилища 120 ГБ;
- галереи (проекты) с папками, массовая загрузка фото drag-and-drop прямо в хранилище;
- автоматические превью (сетка и полноэкранный просмотр) через `sharp`;
- публичная страница галереи `/g/<адрес>`: обложка, светлая/тёмная тема, папки, сетка, лайтбокс;
- пароль на галерею, включение/выключение скачивания;
- избранное клиента: имя, лимит выбора, отправка фотографу с письмом-уведомлением;
- у фотографа: списки избранного, копирование имён файлов для Lightroom / Capture One, экспорт CSV;
- скачивание одного фото или всей галереи / папки в ZIP.

Подробная карта функций WFolio и план следующих этапов — в описании первого PR.

## Стек

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- Хранилище: любое S3-совместимое (Cloudflare R2, AWS S3, MinIO) или локальный диск для разработки

## Запуск локально

```bash
npm install
cp .env.example .env          # отредактируйте при необходимости
createdb wfolio               # или любой Postgres, укажите DATABASE_URL
npm run db:migrate
npm run dev                   # http://localhost:3000
```

По умолчанию `STORAGE_DRIVER=local`: файлы пишутся в `./.storage`, и S3 не нужен.

## Cloudflare R2 / S3

В `.env`:

```
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=wfolio
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Браузер загружает оригиналы напрямую в бакет по подписанной ссылке, поэтому у бакета должен быть CORS,
разрешающий `PUT` и `GET` с адреса приложения, например:

```json
[{ "AllowedOrigins": ["https://your-app.example"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["*"] }]
```

## Деплой на Railway (самый простой способ посмотреть вживую)

Без S3: фото хранятся на диске (volume) Railway.

1. [railway.com](https://railway.com) → **New Project → Deploy from GitHub repo** → `wfolio-clone`.
2. В проекте **+ Create → Database → PostgreSQL**.
3. В сервисе приложения → **Variables** добавьте:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   APP_SECRET=<любая длинная случайная строка>
   STORAGE_DRIVER=local
   LOCAL_STORAGE_DIR=/data
   ```
4. Правой кнопкой по сервису приложения → **Attach volume**, путь `/data`.
5. **Settings → Networking → Generate Domain**. Откройте адрес и зарегистрируйтесь.

Миграции базы применяются автоматически при старте (`npm start`).

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | дев-сервер |
| `npm run build` / `npm start` | продакшен-сборка и запуск (со своими миграциями) |
| `npm run db:generate` | сгенерировать миграцию после изменения `src/db/schema.ts` |
| `npm run db:migrate` | применить миграции |
| `npm test` | юнит-тесты (Vitest) |
| `npm run lint`, `npm run typecheck` | ESLint и TypeScript |

## Устройство

```
src/
  actions/      серверные экшены (auth, проекты, клиентская галерея)
  app/
    api/        загрузка, превью/оригиналы, ZIP, CSV, локальное хранилище
    dashboard/  кабинет фотографа
    g/[slug]/   публичная галерея
  components/   UI (менеджер фото, галерея, формы)
  db/           схема Drizzle и подключение
  lib/          auth, хранилище, обработка изображений, почта, утилиты
drizzle/        SQL-миграции
```
