import { lazy, Suspense, useState } from 'react';
import { Sidebar } from './components/Sidebar';

// Cada página vira um chunk e só é baixada quando o usuário acessa a rota.
const FunilPage = lazy(() => import('./pages/FunilPage').then(module => ({ default: module.FunilPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(module => ({ default: module.ImportPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'funil':
        return <FunilPage />;
      case 'importacao':
        return <ImportPage />;
      case 'dashboard':
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full p-6 text-[var(--text-secondary)]">Carregando página...</div>}>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
