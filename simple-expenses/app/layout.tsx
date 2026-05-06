import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { BottomNav, NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "Simple Expenses",
  description: "Gestão simples de despesas em várias contas e cartões",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Despesas",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
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
          <header
            className="sticky top-0 z-30 border-b border-ink-200 bg-white/80 backdrop-blur dark:bg-ink-900/80 dark:border-ink-800"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
              <Link
                href="/"
                className="font-semibold tracking-tight touch-manipulation"
              >
                Simple Expenses
              </Link>
              <NavLinks />
            </div>
          </header>
          <main
            className="flex-1"
            style={{
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
            }}
          >
            <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8 pb-28 md:pb-8">
              {children}
            </div>
          </main>
          <footer className="hidden md:block border-t border-ink-200 dark:border-ink-800 py-4">
            <div className="mx-auto max-w-5xl px-4 text-xs text-ink-600 dark:text-ink-400">
              Dados guardados localmente no browser. Use Definições para
              exportar/importar.
            </div>
          </footer>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
