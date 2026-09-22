import { useEffect, useState } from 'react';
import { CheckCircle2, Database, FolderOpen, Loader2, Save, Server, XCircle } from 'lucide-react';
import type { DatabaseConfig, DatabaseProvider } from '../types/electron';

const providerOptions: Array<{ value: DatabaseProvider; label: string; description: string }> = [
  { value: 'sqlite', label: 'SQLite', description: 'Banco local no computador' },
  { value: 'postgres', label: 'PostgreSQL', description: 'Servidor PostgreSQL remoto' },
  { value: 'mysql', label: 'MySQL / MariaDB', description: 'Servidor MySQL ou MariaDB remoto' },
  { value: 'supabase', label: 'Supabase', description: 'Projeto Supabase via PostgreSQL' },
  { value: 'turso', label: 'Turso', description: 'SQLite distribuído na nuvem (libSQL)' },
];

type Feedback = { success: boolean; message: string } | null;

export function SettingsPage() {
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
      .catch(() => setFeedback({ success: false, message: 'Não foi possível carregar o banco ativo.' }));
  }, []);

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
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar a configuração.' });
    } finally {
      setSaving(false);
    }
  };

  const selectFolder = async () => {
    const folder = await window.electronAPI.settings.selectFolder();
    if (folder) updateConfig({ filename: `${folder}\\funil_comercial.db` });
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-[var(--accent-color)]">ADMINISTRAÇÃO</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Configurações</h1>
          <p className="mt-2 text-[var(--text-secondary)]">Escolha e configure o banco de dados usado pelo sistema.</p>
        </div>

        <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-sm">
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
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value?: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-[var(--text-primary)]">{label}</span>
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[var(--text-primary)]" />
    </label>
  );
}
