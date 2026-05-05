"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Resumo" },
  { href: "/accounts", label: "Contas" },
  { href: "/expenses", label: "Despesas" },
  { href: "/settings", label: "Definições" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "rounded-md px-3 py-1.5 transition " +
              (active
                ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900"
                : "text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
