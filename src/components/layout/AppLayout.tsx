import { NavLink, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Files, ReceiptText, RefreshCcw, Settings, Wallet2 } from 'lucide-react';

const links: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/documents', label: 'Documentos', icon: Files },
  { to: '/transfers', label: 'Transferências', icon: RefreshCcw },
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/expenses', label: 'Despesas', icon: Wallet2 },
  { to: '/settings', label: 'Definições', icon: Settings }
];

type NavigationVariant = 'sidebar' | 'mobile';

function NavigationList({
  onNavigate,
  variant = 'sidebar'
}: {
  onNavigate?: () => void;
  variant?: NavigationVariant;
}) {
  return (
    <ul
      className={
        variant === 'sidebar'
          ? 'flex flex-col gap-1'
          : 'grid grid-cols-5 gap-2 text-[11px] font-medium'
      }
    >
      {links.map(({ icon: Icon, ...link }) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            className={({ isActive }) =>
              [
                'group',
                variant === 'sidebar'
                  ? 'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors'
                  : 'flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900/10 focus-visible:outline-offset-2',
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              ].join(' ')
            }
            onClick={onNavigate}
          >
            {({ isActive }) =>
              variant === 'sidebar' ? (
                <>
                  <span
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-900/10 group-hover:text-slate-900'
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{link.label}</span>
                </>
              ) : (
                <>
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{link.label}</span>
                </>
              )
            }
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 lg:flex-row">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(12,74,110,0.05),transparent_55%)]" />

      <aside className="relative hidden w-72 flex-col border-r border-slate-200 bg-white/95 px-6 py-8 backdrop-blur-sm lg:flex">
        <div className="mb-8 flex items-center gap-3 text-lg font-semibold text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ReceiptText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI-powered</p>
            <span className="text-xl font-semibold">AI Budget</span>
          </div>
        </div>
        <nav className="flex-1 space-y-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Navegação</p>
            <NavigationList />
          </div>
          <p className="text-xs text-slate-500">
            Organize despesas, transferências e pagamentos futuros com sincronização em tempo real.
          </p>
        </nav>
      </aside>

      <div className="relative z-10 flex flex-1 flex-col">
        <header
          className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-sm lg:hidden"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <div className="flex items-center gap-3 text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ReceiptText className="h-5 w-5" />
            </span>
            <span>AI Budget</span>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
            PWA
          </span>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto px-5 pb-32 pt-6 sm:px-8 sm:pb-12 sm:pt-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8rem)' }}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 pb-10">
            {children}
          </div>
        </motion.main>

        <nav
          className="sticky bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-sm lg:hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <NavigationList variant="mobile" />
        </nav>
      </div>
    </div>
  );
}
