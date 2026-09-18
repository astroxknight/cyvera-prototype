import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import DashboardPage from './pages/DashboardPage';
import LogAnalysisPage from './pages/LogAnalysisPage';
import AlertsPage from './pages/AlertsPage';
import AlertDetailPage from './pages/AlertDetailPage';
import SignaturesPage from './pages/SignaturesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';
import './styles/components.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <Topbar />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/logs" element={<LogAnalysisPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/alerts/:id" element={<AlertDetailPage />} />
              <Route path="/signatures" element={<SignaturesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
