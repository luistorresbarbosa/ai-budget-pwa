import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DocumentsPage from './pages/DocumentsPage';
import TransfersPage from './pages/TransfersPage';
import TimelinePage from './pages/TimelinePage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useIntegrationLogsSync } from './hooks/useIntegrationLogsSync';

function App() {
  useFirestoreSync();
  useIntegrationLogsSync();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
