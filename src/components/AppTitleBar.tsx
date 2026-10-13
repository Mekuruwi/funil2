import { useEffect, useRef, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

type MenuName = 'Arquivo' | 'Editar' | 'Exibir';
type MenuItem = { label: string; command?: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'; action?: () => void; separator?: boolean };

const menuItems: Record<MenuName, MenuItem[]> = {
  Arquivo: [
    { label: 'Verificar atualizações', action: () => { void window.electronAPI.updates.check(); } },
    { label: '', separator: true },
    { label: 'Recarregar aplicativo', action: () => window.location.reload() },
    { label: '', separator: true },
    {
      label: 'Desinstalar aplicativo',
      action: () => {
        if (window.confirm('Abrir as configurações do Windows para desinstalar o Funil Comercial?')) {
          void window.electronAPI.openUninstallSettings();
        }
      },
    },
    { label: '', separator: true },
    { label: 'Sair', action: () => { void window.electronAPI.windowControls.close(); } },
  ],
  Editar: [
    { label: 'Desfazer', command: 'undo' },
    { label: 'Refazer', command: 'redo' },
    { label: '', separator: true },
    { label: 'Recortar', command: 'cut' },
    { label: 'Copiar', command: 'copy' },
    { label: 'Colar', command: 'paste' },
    { label: 'Selecionar tudo', command: 'selectAll' },
  ],
  Exibir: [
    { label: 'Alternar tela cheia', action: () => { void window.electronAPI.windowControls.toggleFullscreen(); } },
    { label: 'Recarregar aplicativo', action: () => window.location.reload() },
  ],
};

export function AppTitleBar() {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const runItem = (item: MenuItem) => {
    if (item.command) void window.electronAPI.windowControls.editCommand(item.command);
    item.action?.();
    setOpenMenu(null);
  };

  return <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <div className="app-drag-region flex h-10 items-center justify-between border-b border-[var(--border-color)]/70 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-color)]" />
        <span className="truncate text-sm font-semibold">Funil Comercial</span>
      </div>
      <div className="app-no-drag flex h-full items-center" aria-label="Controles da janela">
        <button type="button" title="Minimizar" aria-label="Minimizar janela" onClick={() => void window.electronAPI.windowControls.minimize()} className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"><Minus size={16} /></button>
        <button type="button" title="Maximizar ou restaurar" aria-label="Maximizar ou restaurar janela" onClick={() => void window.electronAPI.windowControls.toggleMaximize()} className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"><Square size={13} /></button>
        <button type="button" title="Fechar" aria-label="Fechar aplicativo" onClick={() => void window.electronAPI.windowControls.close()} className="flex h-full w-12 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-red-600 hover:text-white"><X size={17} /></button>
      </div>
    </div>

    <nav ref={menuRef} role="menubar" aria-label="Menu do aplicativo" className="app-no-drag relative flex h-9 items-center gap-1 px-2">
      {(Object.keys(menuItems) as MenuName[]).map(name => <div key={name} className="relative">
        <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={openMenu === name} onClick={() => setOpenMenu(current => current === name ? null : name)} onMouseEnter={() => openMenu && setOpenMenu(name)} className={`rounded-md px-3 py-1 text-sm transition-colors ${openMenu === name ? 'bg-[var(--accent-color)]/10 text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}>{name}</button>
        {openMenu === name && <div role="menu" className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-1.5 shadow-xl">
          {menuItems[name].map((item, index) => item.separator
            ? <div key={`separator-${index}`} role="separator" className="my-1 border-t border-[var(--border-color)]" />
            : <button key={item.label} type="button" role="menuitem" onClick={() => runItem(item)} className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]">{item.label}</button>)}
        </div>}
      </div>)}
    </nav>
  </div>;
}
