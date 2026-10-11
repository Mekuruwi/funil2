import { useEffect, useState } from 'react';
import { CheckCircle2, Database, FileSpreadsheet, FileText, FolderOpen, Loader2, Moon, Palette, Save, Server, Sun, Upload, XCircle } from 'lucide-react';
import type { DatabaseConfig, DatabaseProvider, DocumentSettings, PriceCatalogRow } from '../types/electron';
import { reportError } from '../utils/errorReporting';
import { readExcelFile } from '../services/excelService';
import { useThemeStore, type CustomThemeColors, type ThemeStyle } from '../store/themeStore';

const providerOptions: Array<{ value: DatabaseProvider; label: string; description: string }> = [
  { value: 'sqlite', label: 'SQLite', description: 'Banco local no computador' },
  { value: 'postgres', label: 'PostgreSQL', description: 'Servidor PostgreSQL remoto' },
  { value: 'mysql', label: 'MySQL / MariaDB', description: 'Servidor MySQL ou MariaDB remoto' },
  { value: 'supabase', label: 'Supabase', description: 'Projeto Supabase via PostgreSQL' },
  { value: 'turso', label: 'Turso', description: 'SQLite distribuído na nuvem (libSQL)' },
];

type Feedback = { success: boolean; message: string } | null;

const appearanceStyles: Array<{ id: Exclude<ThemeStyle, 'personalizado'>; name: string; description: string; colors: [string, string] }> = [
  { id: 'corporativo', name: 'Corporativo', description: 'Azul marinho e visual executivo', colors: ['#1B2A4E', '#818CF8'] },
  { id: 'oceano', name: 'Oceano', description: 'Tons de azul e verde água', colors: ['#087E8B', '#2DD4BF'] },
  { id: 'floresta', name: 'Floresta', description: 'Verdes naturais e suaves', colors: ['#28734A', '#6BCB8B'] },
  { id: 'violeta', name: 'Violeta', description: 'Roxo elegante e contemporâneo', colors: ['#7045A2', '#C4A1F2'] },
  { id: 'terracota', name: 'Terracota', description: 'Tons quentes e acolhedores', colors: ['#B64F32', '#F29A78'] },
];

export function SettingsPage() {
  const { theme, style, customColors, setTheme, setStyle, setCustomColors } = useThemeStore();
  const [config, setConfig] = useState<DatabaseConfig>({
    provider: 'sqlite',
    filename: '',
    port: 5432,
    ssl: true,
  });
  const [currentProvider, setCurrentProvider] = useState<DatabaseProvider>('sqlite');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings | null>(null);
  const [documentFeedback, setDocumentFeedback] = useState<Feedback>(null);
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [importingPrices, setImportingPrices] = useState(false);
  const [activeSection, setActiveSection] = useState<'database' | 'documents' | 'appearance'>('database');

  useEffect(() => {
    window.electronAPI.database.getCurrentConfig()
      .then((savedConfig) => {
        setCurrentProvider(savedConfig.provider);
        setConfig((current) => ({
          ...current,
          ...savedConfig,
          port: savedConfig.port || (savedConfig.provider === 'mysql' ? 3306 : 5432),
        }));
      })
      .catch((error: unknown) => {
        reportError('Falha ao carregar configuração do banco', error);
        setFeedback({ success: false, message: 'Não foi possível carregar o banco ativo.' });
      });
  }, []);

  useEffect(() => {
    window.electronAPI.settings.getDocumentSettings()
      .then(setDocumentSettings)
      .catch((error: unknown) => {
        reportError('Falha ao carregar preferências de documentos', error);
        setDocumentFeedback({ success: false, message: 'Não foi possível carregar as configurações de documentos.' });
      });
  }, []);

  const chooseTemplate = async (kind: 'proposal' | 'contract' | 'addendum') => {
    if (!documentSettings) return;
    const template = await window.electronAPI.settings.selectDocumentTemplate(kind);
    if (!template) return;
    const updated = { ...documentSettings, templates: { ...documentSettings.templates, [kind]: template } };
    setDocumentSettings(updated);
    await persistDocumentSettings(updated);
  };

  const chooseOutputFolder = async () => {
    if (!documentSettings) return;
    const folder = await window.electronAPI.settings.selectDocumentOutputFolder();
    if (!folder) return;
    const updated = { ...documentSettings, outputFolder: folder };
    setDocumentSettings(updated);
    await persistDocumentSettings(updated);
  };

  const persistDocumentSettings = async (settings: DocumentSettings) => {
    setSavingDocuments(true);
    setDocumentFeedback(null);
    try {
      const saved = await window.electronAPI.settings.saveDocumentSettings(settings);
      setDocumentSettings(saved);
      setDocumentFeedback({ success: true, message: 'Preferências de documentos salvas.' });
    } catch (error) {
      reportError('Falha ao salvar preferências de documentos', error);
      setDocumentFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar as preferências.' });
    } finally {
      setSavingDocuments(false);
    }
  };

  const importPrices = async (file?: File) => {
    if (!file || !documentSettings) return;
    setImportingPrices(true);
    setDocumentFeedback(null);
    try {
      const result = await readExcelFile(file);
      if (!result.success || !result.data) throw new Error(result.error || 'Não foi possível ler a planilha.');
      const find = (row: Record<string, unknown>, aliases: string[]) => {
        const key = Object.keys(row).find(candidate => aliases.includes(candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')));
        return key ? row[key] : undefined;
      };
      const rows: PriceCatalogRow[] = result.data.map((raw) => {
        const row = raw as Record<string, unknown>;
        const rawValue = find(row, ['valor base', 'valorbase', 'valor']);
        const numericText = String(rawValue ?? '').trim();
        const normalizedValue = numericText.includes(',')
          ? numericText.replace(/\./g, '').replace(',', '.')
          : numericText;
        const numericValue = typeof rawValue === 'number' ? rawValue : Number(normalizedValue);
        return {
          exam: String(find(row, ['exames', 'exame']) ?? '').trim(),
          order: Number(find(row, ['ordem'])),
          service: String(find(row, ['servico', 'serviço']) ?? '').trim(),
          baseValue: numericValue,
        };
      });
      const resultImport = await window.electronAPI.settings.importPriceCatalog(rows);
      const updated = { ...documentSettings, priceCatalog: rows, priceCatalogName: file.name };
      const saved = await window.electronAPI.settings.saveDocumentSettings(updated);
      setDocumentSettings({ ...saved, priceCatalogName: file.name });
      setDocumentFeedback({ success: true, message: `${resultImport.count} preços importados de ${file.name}.` });
    } catch (error) {
      reportError('Falha ao importar tabela de preços', error);
      setDocumentFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível importar a planilha.' });
    } finally {
      setImportingPrices(false);
    }
  };

  const updateConfig = (values: Partial<DatabaseConfig>) => {
    setConfig((current) => ({ ...current, ...values }));
    setFeedback(null);
  };

  const handleProviderChange = (provider: DatabaseProvider) => {
    updateConfig({
      provider,
      port: provider === 'mysql' ? 3306 : 5432,
      connectionString: provider === 'supabase' ? config.connectionString : undefined,
    });
  };

  const testConnection = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await window.electronAPI.database.testConnection(config);
      setFeedback(result.success
        ? { success: true, message: 'Conexão testada com sucesso.' }
        : { success: false, message: result.error || 'Não foi possível conectar ao banco.' });
    } catch (error) {
      reportError('Falha ao testar conexão com o banco', error);
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Falha ao testar a conexão.' });
    } finally {
      setTesting(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await window.electronAPI.database.switchProvider(config);
      setCurrentProvider(config.provider);
      setFeedback({ success: true, message: 'Configuração salva e banco ativo atualizado.' });
    } catch (error) {
      reportError('Falha ao salvar configuração do banco', error);
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar a configuração.' });
    } finally {
      setSaving(false);
    }
  };

  const selectFolder = async () => {
    try {
      const folder = await window.electronAPI.settings.selectFolder();
      if (folder) updateConfig({ filename: `${folder}\\funil_comercial.db` });
    } catch (error) {
      reportError('Falha ao selecionar pasta do banco', error);
      setFeedback({ success: false, message: 'Não foi possível selecionar a pasta do banco.' });
    }
  };

  const updateCustomColor = (mode: keyof CustomThemeColors, key: 'accent' | 'background', value: string) => {
    setCustomColors({ ...customColors, [mode]: { ...customColors[mode], [key]: value } });
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="w-full">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-[var(--accent-color)]">ADMINISTRAÇÃO</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Configurações</h1>
          <p className="mt-2 text-[var(--text-secondary)]">Configure a aparência, o banco de dados e os documentos comerciais.</p>
        </div>

        <div role="tablist" aria-label="Seções de configurações" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'database'}
            aria-controls="settings-database-panel"
            onClick={() => setActiveSection('database')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${activeSection === 'database' ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <span className={`rounded-lg p-2 ${activeSection === 'database' ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}><Database size={19} /></span>
            <span>
              <span className="block font-semibold text-[var(--text-primary)]">Banco de dados</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">Provedor e conexão ativa</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'documents'}
            aria-controls="settings-documents-panel"
            onClick={() => setActiveSection('documents')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${activeSection === 'documents' ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <span className={`rounded-lg p-2 ${activeSection === 'documents' ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}><FileText size={19} /></span>
            <span>
              <span className="block font-semibold text-[var(--text-primary)]">Documentos comerciais</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">Modelos, destino e tabela de preços</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'appearance'}
            aria-controls="settings-appearance-panel"
            onClick={() => setActiveSection('appearance')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${activeSection === 'appearance' ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <span className={`rounded-lg p-2 ${activeSection === 'appearance' ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}><Palette size={19} /></span>
            <span>
              <span className="block font-semibold text-[var(--text-primary)]">Aparência</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">Estilo, cores e tema claro/escuro</span>
            </span>
          </button>
        </div>

        {activeSection === 'appearance' && <section id="settings-appearance-panel" role="tabpanel" className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[var(--accent-color)] p-2 text-white"><Palette size={20} /></div>
              <div><h2 className="font-semibold text-[var(--text-primary)]">Estilo visual</h2><p className="text-sm text-[var(--text-secondary)]">Escolha uma paleta para personalizar toda a aplicação.</p></div>
            </div>
            <div role="group" aria-label="Modo de cor" className="inline-flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-1">
              <button type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${theme === 'light' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}><Sun size={16} /> Claro</button>
              <button type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${theme === 'dark' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}><Moon size={16} /> Escuro</button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {appearanceStyles.map(option => <button key={option.id} type="button" aria-pressed={style === option.id} onClick={() => setStyle(option.id)} className={`rounded-xl border p-4 text-left transition-colors ${style === option.id ? 'border-[var(--accent-color)] bg-[var(--bg-primary)] ring-2 ring-[var(--accent-color)]/15' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent-color)]'}`}>
              <span className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">{option.name}</span>
                {style === option.id && <CheckCircle2 size={18} className="text-[var(--accent-color)]" />}
              </span>
              <span className="mb-3 block text-sm text-[var(--text-secondary)]">{option.description}</span>
              <span className="flex gap-2" aria-label={`Amostra ${option.name}`}>
                <span className="flex h-8 flex-1 items-center gap-2 rounded-md border px-2" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#1F2937', borderColor: option.colors[0] }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.colors[0] }} /><span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: theme === 'light' ? '#CBD5E1' : '#64748B' }} /></span>
                <span className="flex h-8 flex-1 items-center gap-2 rounded-md border px-2" style={{ backgroundColor: theme === 'dark' ? '#111827' : '#F3F4F6', borderColor: option.colors[1] }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.colors[1] }} /><span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#64748B' : '#CBD5E1' }} /></span>
              </span>
            </button>)}
            <button type="button" aria-pressed={style === 'personalizado'} onClick={() => setStyle('personalizado')} className={`rounded-xl border p-4 text-left transition-colors ${style === 'personalizado' ? 'border-[var(--accent-color)] bg-[var(--bg-primary)] ring-2 ring-[var(--accent-color)]/15' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent-color)]'}`}>
              <span className="mb-3 flex items-center justify-between"><span className="font-semibold text-[var(--text-primary)]">Personalizado</span>{style === 'personalizado' && <CheckCircle2 size={18} className="text-[var(--accent-color)]" />}</span>
              <span className="mb-3 block text-sm text-[var(--text-secondary)]">Defina cores de destaque e fundo para cada modo.</span>
              <span className="flex gap-2"><span className="h-8 flex-1 rounded-md border" style={{ backgroundColor: customColors.light.background, borderColor: customColors.light.accent }} /><span className="h-8 flex-1 rounded-md border" style={{ backgroundColor: customColors.dark.background, borderColor: customColors.dark.accent }} /></span>
            </button>
          </div>

          {style === 'personalizado' && <div className="mt-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 sm:p-5">
            <h3 className="mb-4 font-semibold text-[var(--text-primary)]">Cores personalizadas</h3>
            <div className="grid gap-5 lg:grid-cols-2">
              {(['light', 'dark'] as const).map(mode => <div key={mode} className="rounded-lg border border-[var(--border-color)] p-4">
                <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Modo {mode === 'light' ? 'claro' : 'escuro'}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField label="Cor de destaque" value={customColors[mode].accent} onChange={value => updateCustomColor(mode, 'accent', value)} />
                  <ColorField label="Cor de fundo" value={customColors[mode].background} onChange={value => updateCustomColor(mode, 'background', value)} />
                </div>
              </div>)}
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">Os textos e bordas se ajustam automaticamente ao modo selecionado.</p>
          </div>}
        </section>}

        {activeSection === 'database' && <section id="settings-database-panel" role="tabpanel" className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-[var(--accent-color)] p-2 text-white"><Database size={20} /></div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Banco de dados ativo</h2>
              <p className="text-sm text-[var(--text-secondary)]">Atual: {providerOptions.find((item) => item.value === currentProvider)?.label}</p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]" htmlFor="provider">Provedor</label>
          <select
            id="provider"
            value={config.provider}
            onChange={(event) => handleProviderChange(event.target.value as DatabaseProvider)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          >
            {providerOptions.map((provider) => <option key={provider.value} value={provider.value}>{provider.label} — {provider.description}</option>)}
          </select>

          {config.provider === 'sqlite' ? (
            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]" htmlFor="filename">Arquivo do banco</label>
              <div className="flex gap-2">
                <input id="filename" value={config.filename || ''} readOnly placeholder="Selecione uma pasta para o banco" className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-primary)]" />
                <button onClick={selectFolder} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-color)]"><FolderOpen size={16} /> Selecionar</button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Se ficar vazio, o banco padrão da pasta de dados do Electron será usado.</p>
            </div>
          ) : config.provider === 'turso' ? (
            <div className="mt-5 grid gap-4">
              <Field label="URL do banco Turso" value={config.connectionString} onChange={(connectionString) => updateConfig({ connectionString })} placeholder="libsql://seu-banco.turso.io" />
              <Field label="Token de autenticação" value={config.authToken} onChange={(authToken) => updateConfig({ authToken })} placeholder="Token do Turso" type="password" />
              <p className="text-xs text-[var(--text-secondary)]">No dashboard do Turso, copie a URL do banco e gere um token de autenticação em <strong>Connect</strong>.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {config.provider === 'supabase' && (
                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Connection string</span>
                  <input value={config.connectionString || ''} onChange={(event) => updateConfig({ connectionString: event.target.value })} placeholder="postgresql://..." type="password" className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-primary)]" />
                </label>
              )}
              <Field label="Host" value={config.host} onChange={(host) => updateConfig({ host })} placeholder="localhost" />
              <Field label="Porta" value={String(config.port || '')} onChange={(port) => updateConfig({ port: Number(port) || undefined })} placeholder={config.provider === 'mysql' ? '3306' : '5432'} type="number" />
              <Field label="Usuário" value={config.user} onChange={(user) => updateConfig({ user })} placeholder="Usuário do banco" />
              <Field label="Senha" value={config.password} onChange={(password) => updateConfig({ password })} placeholder="Senha" type="password" />
              {config.provider !== 'supabase' && <Field label="Banco de dados" value={config.database} onChange={(database) => updateConfig({ database })} placeholder="Nome do banco" />}
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--text-primary)]">
                <input type="checkbox" checked={Boolean(config.ssl)} onChange={(event) => updateConfig({ ssl: event.target.checked })} />
                Usar SSL
              </label>
            </div>
          )}

          {feedback && (
            <div className={`mt-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              {feedback.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {feedback.message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button onClick={testConnection} disabled={testing} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-color)] disabled:opacity-60">
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Server size={16} />} Testar conexão
            </button>
            <button onClick={saveConfiguration} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar configuração
            </button>
          </div>
        </section>}

        {activeSection === 'documents' && <section id="settings-documents-panel" role="tabpanel" className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-[var(--accent-color)] p-2 text-white"><FileText size={20} /></div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Propostas e contratos</h2>
              <p className="text-sm text-[var(--text-secondary)]">Configure os modelos padrão e a tabela de preços usada na geração dos documentos.</p>
            </div>
          </div>
          {documentSettings ? <div className="space-y-5">
            {([
              ['proposal', 'Modelo de proposta (PPTX)'],
              ['contract', 'Modelo de contrato (DOCX)'],
              ['addendum', 'Modelo de termo aditivo (DOCX)'],
            ] as const).map(([kind, label]) => (
              <div key={kind} className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                <Field label={label} value={documentSettings.templates[kind] || ''} onChange={() => undefined} placeholder="Nenhum modelo configurado" readOnly />
                <button onClick={() => void chooseTemplate(kind)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--border-color)]"><FolderOpen size={16} /> Escolher modelo</button>
              </div>
            ))}
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Pasta padrão de destino" value={documentSettings.outputFolder || ''} onChange={() => undefined} placeholder="Selecione a pasta para salvar os documentos" readOnly />
              <button onClick={() => void chooseOutputFolder()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--border-color)]"><FolderOpen size={16} /> Escolher pasta</button>
            </div>
            <div className="rounded-lg border border-[var(--border-color)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-medium text-[var(--text-primary)]"><FileSpreadsheet size={18} /> Tabela de preços dos exames</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Colunas aceitas: exames, ORDEM, SERVIÇO e Valor base.</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{documentSettings.priceCatalogName || 'Nenhuma tabela importada'}{documentSettings.priceCatalog.length ? ` · ${documentSettings.priceCatalog.length} itens` : ''}</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
                  {importingPrices ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Importar XLSX
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importingPrices} onChange={(event) => { void importPrices(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                </label>
              </div>
            </div>
            {savingDocuments && <p className="text-sm text-[var(--text-secondary)]"><Loader2 size={14} className="mr-1 inline animate-spin" /> Salvando configurações...</p>}
            {documentFeedback && <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${documentFeedback.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              {documentFeedback.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{documentFeedback.message}
            </div>}
          </div> : <p className="text-sm text-[var(--text-secondary)]">Carregando configurações...</p>}
        </section>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', readOnly = false }: { label: string; value?: string; onChange: (value: string) => void; placeholder: string; type?: string; readOnly?: boolean }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} readOnly={readOnly} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-primary)] read-only:opacity-80" />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm text-[var(--text-primary)]">
    <span>{label}</span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs text-[var(--text-secondary)]">{value.toUpperCase()}</span>
      <input aria-label={label} type="color" value={value} onChange={event => onChange(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[var(--border-color)] bg-transparent p-1" />
    </span>
  </label>;
}
