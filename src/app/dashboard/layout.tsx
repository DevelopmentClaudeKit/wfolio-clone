import Link from "next/link";
import { logOut } from "@/actions/auth";
import { requireUser } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { storageUsed } from "@/lib/projects";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const used = await storageUsed(user.id);
  const pct = Math.min(100, (used / user.storageQuotaBytes) * 100);
  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">wfolio·clone</Link>
          <div className="flex items-center gap-4 text-sm">
            <div className="hidden w-48 sm:block" title={`${formatBytes(used)} из ${formatBytes(user.storageQuotaBytes)}`}>
              <div className="h-1.5 overflow-hidden rounded bg-neutral-200">
                <div className="h-full bg-neutral-900" style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {formatBytes(used)} из {formatBytes(user.storageQuotaBytes)}
              </p>
            </div>
            <span className="text-neutral-600">{user.name}</span>
            <form action={logOut}>
              <button className="text-neutral-500 hover:text-neutral-900">Выйти</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
