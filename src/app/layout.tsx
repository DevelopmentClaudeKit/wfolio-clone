import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WFolio Clone", template: "%s · WFolio Clone" },
  description: "Онлайн-галереи для фотографов: отдавайте съёмки красиво.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
