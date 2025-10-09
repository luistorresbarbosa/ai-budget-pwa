import { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, footer, children }: PropsWithChildren<ModalProps>) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [open, onClose]);

  const titleId = useId();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50 shadow-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.9, rotateX: -12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 40, scale: 0.9, rotateX: -8 }}
            transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.6 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="absolute -inset-20 -z-10 opacity-30 blur-3xl"
              aria-hidden="true"
            >
              <motion.div
                className="h-full w-full bg-gradient-to-br from-sky-500 via-purple-500 to-amber-500"
                initial={{ rotate: 0 }}
                animate={{ rotate: 8 }}
                transition={{ repeat: Infinity, repeatType: 'mirror', duration: 10, ease: 'easeInOut' }}
              />
            </div>

            <div className="relative space-y-6 p-6">
              <header className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <h2 id={titleId} className="text-xl font-semibold text-slate-900 sm:text-2xl">
                    {title}
                  </h2>
                  {description && <p className="text-sm text-slate-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4">{children}</div>

              {footer && <footer className="flex flex-wrap items-center justify-end gap-3 pt-2">{footer}</footer>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
