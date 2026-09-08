import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { FunilPage } from './pages/FunilPage';
import { ImportPage } from './pages/ImportPage';
import { DashboardPage } from './pages/DashboardPage';

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
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
