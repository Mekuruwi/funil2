import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  KanbanSquare, 
  Upload, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'funil', label: 'Funil', icon: KanbanSquare },
  { id: 'importacao', label: 'Importação', icon: Upload },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside 
      className={`
        h-screen bg-[var(--bg-secondary)] border-r border-[var(--border-color)]
        transition-all duration-300 flex flex-col
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-lg font-bold text-[var(--text-primary)]">
            Funil Comercial
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-[var(--border-color)] text-[var(--text-secondary)]"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-lg
                transition-colors duration-200
                ${isActive 
                  ? 'bg-[var(--accent-color)] text-white' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                }
              `}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="p-4 border-t border-[var(--border-color)]">
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center justify-center gap-3 px-3 py-3 rounded-lg
            text-[var(--text-secondary)] hover:bg-[var(--border-color)]
            transition-colors duration-200
          `}
          title={theme === 'light' ? 'Tema Escuro' : 'Tema Claro'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          {!collapsed && <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>}
        </button>
      </div>
    </aside>
  );
};
