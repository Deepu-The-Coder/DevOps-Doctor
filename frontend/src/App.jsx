import { Navigate, Route, Routes } from 'react-router-dom';
import TopBar from './components/TopBar.jsx';
import { useThemeShortcut } from './theme/theme.js';
import Workspace from './pages/Workspace.jsx';
import Cases from './pages/Cases.jsx';
import NotFound from './pages/NotFound.jsx';
import Benchmarks from './pages/Benchmarks.jsx';
import HowItWorks from './pages/HowItWorks.jsx';

export default function App() {
  useThemeShortcut();
  return (
    <div className="shell" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar />
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          {/* Overview (P1) not built yet, so "/" goes to the workspace. */}
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<Workspace />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/benchmarks" element={<Benchmarks />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
