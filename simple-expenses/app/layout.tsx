import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "Simple Expenses",
  description: "Gestão simples de despesas em várias contas e cartões",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-ink-200 bg-white/70 backdrop-blur dark:bg-ink-900/70 dark:border-ink-800">
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
              <Link href="/" className="font-semibold tracking-tight">
                Simple Expenses
              </Link>
              <NavLinks />
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</div>
          </main>
          <footer className="border-t border-ink-200 dark:border-ink-800 py-4">
            <div className="mx-auto max-w-5xl px-4 text-xs text-ink-600 dark:text-ink-400">
              Dados guardados localmente no browser. Use Definições para exportar/importar.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
