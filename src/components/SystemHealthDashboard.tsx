import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Database, RefreshCw, Server, X } from 'lucide-react';
import { useSystemHealthStore } from '../store/systemHealthStore';
import { formatDate } from '../utils/formatters';
import { FadeIn } from './FadeIn';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusConfig = {
  success: { label: 'Saudável', className: 'text-emerald-700 bg-emerald-100', Icon: CheckCircle2 },
  warning: { label: 'Atenção', className: 'text-amber-700 bg-amber-100', Icon: AlertTriangle },
  error: { label: 'Erro', className: 'text-red-700 bg-red-100', Icon: AlertCircle },
} as const;

export const SystemHealthDashboard: React.FC = () => {
  const { metrics, isLoading, error, fetchMetrics } = useSystemHealthStore();
  const [details, setDetails] = useState<'database' | 'records' | 'validation' | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading && !metrics) {
    return <div className="p-6 text-[var(--text-secondary)]">Carregando saúde do sistema...</div>;
  }

  if (error && !metrics) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle size={20} /> {error}
        </div>
      </div>
    );
  }

  if (!metrics) return null;
  const operationStatus = metrics.latestOperation?.status || (metrics.validationErrors ? 'warning' : 'success');
  const StatusIcon = statusConfig[operationStatus].Icon;

  return (
    <FadeIn className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saúde do Sistema</h1>
        <button onClick={() => fetchMetrics()} disabled={isLoading} className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] disabled:opacity-50">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FadeIn delay={40}><MetricCard icon={Database} title="Banco de dados" value={formatBytes(metrics.databaseSizeBytes)} onClick={() => setDetails('database')} /></FadeIn>
        <FadeIn delay={80}><MetricCard icon={Server} title="Registros ativos" value={metrics.activeRecords.toLocaleString('pt-BR')} onClick={() => setDetails('records')} /></FadeIn>
        <FadeIn delay={120}><MetricCard icon={AlertCircle} title="Erros de validação" value={metrics.validationErrors.toLocaleString('pt-BR')} tone={metrics.validationErrors ? 'warning' : 'success'} onClick={() => setDetails('validation')} /></FadeIn>
      </div>

      {details && (
        <DetailsPanel title={details === 'database' ? 'Tamanho por base' : details === 'records' ? 'Registros por base' : 'Erros de validação'} onClose={() => setDetails(null)}>
          {details === 'database' && (
            <div className="space-y-2">
              {metrics.databaseTables.map((table) => (
                <DetailRow key={table.name} label={tableLabel(table.name)} value={formatBytes(table.sizeBytes)} secondary={`${table.rows.toLocaleString('pt-BR')} registros`} />
              ))}
            </div>
          )}
          {details === 'records' && (
            <div className="space-y-2">
              {metrics.activeRecordsByTable.map((table) => (
                <DetailRow key={table.name} label={tableLabel(table.name)} value={table.rows.toLocaleString('pt-BR')} secondary="registros ativos" />
              ))}
            </div>
          )}
          {details === 'validation' && (
            <div className="space-y-2">
              {metrics.validationIssues.filter((issue) => issue.count > 0).map((issue) => (
                <DetailRow key={issue.code} label={issue.label} value={issue.count.toLocaleString('pt-BR')} secondary={`Base: ${tableLabel(issue.table)}`} />
              ))}
              {!metrics.validationIssues.some((issue) => issue.count > 0) && <p className="text-sm text-[var(--text-secondary)]">Nenhum erro de validação encontrado.</p>}
            </div>
          )}
        </DetailsPanel>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
          <h2 className="mb-4 font-semibold">Acessos e uso</h2>
          <div className="space-y-3 text-sm">
            <Row label="Último acesso" value={metrics.lastAccessAt ? formatDate(metrics.lastAccessAt) : '—'} />
            <Row label="Importações no período" value={metrics.currentPeriodImports.toLocaleString('pt-BR')} />
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
          <h2 className="mb-4 font-semibold">Última operação</h2>
          <div className="flex items-center gap-3">
            <StatusIcon size={22} className={operationStatus === 'success' ? 'text-emerald-600' : operationStatus === 'warning' ? 'text-amber-600' : 'text-red-600'} />
            <div>
              <p className="font-medium">{metrics.latestOperation?.operation || 'Nenhuma operação registrada'}</p>
              <p className="text-sm text-[var(--text-secondary)]">{metrics.latestOperation ? formatDate(metrics.latestOperation.createdAt) : '—'}</p>
            </div>
            <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[operationStatus].className}`}>{statusConfig[operationStatus].label}</span>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
        <h2 className="mb-4 font-semibold">Histórico de importações</h2>
        <div className="space-y-2">
          {metrics.recentImports.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Nenhuma importação registrada.</p>}
          {metrics.recentImports.map((item) => {
            const config = statusConfig[item.status];
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm">
                <config.Icon size={17} className={item.status === 'success' ? 'text-emerald-600' : item.status === 'warning' ? 'text-amber-600' : 'text-red-600'} />
                <span className="flex-1">{item.operation}</span>
                <span className="text-[var(--text-secondary)]">{item.records.toLocaleString('pt-BR')} registros</span>
                <span className="text-[var(--text-secondary)]">{formatDate(item.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </FadeIn>
  );
};

const MetricCard: React.FC<{ icon: React.ElementType; title: string; value: string; tone?: 'success' | 'warning'; onClick: () => void }> = ({ icon: Icon, title, value, tone, onClick }) => (
  <button type="button" onClick={onClick} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-5 text-left transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-[var(--accent-color)] hover:shadow-sm active:translate-y-0">
    <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Icon size={18} /> {title}</div>
    <p className={`text-2xl font-bold ${tone === 'warning' ? 'text-amber-600' : tone === 'success' ? 'text-emerald-600' : ''}`}>{value}</p>
    <p className="mt-2 text-xs text-[var(--text-secondary)]">Ver detalhes</p>
  </button>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between border-b border-[var(--border-color)] pb-2 last:border-0"><span className="text-[var(--text-secondary)]">{label}</span><span className="font-medium">{value}</span></div>
);

const tableLabel = (name: string) => ({
  regionais: 'Regionais',
  funil: 'Funil',
  observacoes: 'Observações',
  import_operations: 'Operações de importação',
  system_access: 'Acessos ao sistema',
}[name] || name);

const DetailsPanel: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <section className="mt-4 rounded-lg border border-[var(--accent-color)] bg-[var(--bg-primary)] p-5">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-semibold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Fechar detalhes" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"><X size={18} /></button>
    </div>
    {children}
  </section>
);

const DetailRow: React.FC<{ label: string; value: string; secondary: string }> = ({ label, value, secondary }) => (
  <div className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
    <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-[var(--text-secondary)]">{secondary}</p></div>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);
