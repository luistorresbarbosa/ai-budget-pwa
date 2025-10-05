import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import UploadPage from './pages/UploadPage';
import TransfersPage from './pages/TransfersPage';
import TimelinePage from './pages/TimelinePage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import { useFirestoreSync } from './hooks/useFirestoreSync';

function App() {
  useFirestoreSync();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
