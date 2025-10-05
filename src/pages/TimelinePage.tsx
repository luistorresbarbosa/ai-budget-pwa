import { motion } from 'framer-motion';
import { useAppState } from '../state/AppStateContext';
import { TimelineBoard } from '../components/timeline/TimelineBoard';

function TimelinePage() {
  const timeline = useAppState((state) => state.timeline);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Timeline</h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Visualize num só calendário todos os pagamentos, vencimentos e transferências.
        </p>
      </header>
      <TimelineBoard entries={timeline} />
    </motion.section>
  );
}

export default TimelinePage;
