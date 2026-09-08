import React, { useState, useEffect } from 'react';
import { useFunilStore } from '../store/funilStore';
import { FASES_FUNIL } from '../types';
import { formatCurrencyBRL, calculateSLA, formatDate } from '../utils/formatters';
import { TrendingUp, Users, FilePlus, History } from 'lucide-react';
import { Modal } from '../components/Modal';

export const DashboardPage: React.FC = () => {
  const { fetchFunis, funis } = useFunilStore();
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    negocio: '',
    regional: '',
    fase: '',
    responsavel: '',
  });
  const [selectedHistorico, setSelectedHistorico] = useState<any>(null);

  useEffect(() => {
    fetchFunis();
  }, []);

  useEffect(() => {
    loadDashboardStats();
  }, [funis, filters]);

  const loadDashboardStats = async () => {
    try {
      const result = await window.electronAPI.getDashboardStats(filters);
      setStats(result);
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  };

  // Agrupar funis por fase
  const funisPorFase = FASES_FUNIL.map(fase => {
    const funisDaFase = funis.filter(f => String(f.fase) === String(fase.id));
    const totalPotencial = funisDaFase.reduce((sum, f) => sum + f.potencial, 0);
    const slaMedio = funisDaFase.length > 0
      ? Math.round(funisDaFase.reduce((sum, f) => sum + calculateSLA(f.data_criacao, f.fase), 0) / funisDaFase.length)
      : 0;

    return {
      ...fase,
      count: funisDaFase.length,
      totalPotencial,
      slaMedio,
      funis: funisDaFase,
    };
  }).filter(f => f.count > 0);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Dashboard</h1>

      {/* Filtros Globais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="Negócio"
          value={filters.negocio}
          onChange={(e) => setFilters(prev => ({ ...prev, negocio: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        />
        <input
          type="text"
          placeholder="Regional"
          value={filters.regional}
          onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        />
        <select
          value={filters.fase}
          onChange={(e) => setFilters(prev => ({ ...prev, fase: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todas as Fases</option>
          {FASES_FUNIL.map(fase => (
            <option key={fase.id} value={fase.id}>{fase.nome}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Responsável"
          value={filters.responsavel}
          onChange={(e) => setFilters(prev => ({ ...prev, responsavel: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        />
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard
          icon={<TrendingUp size={24} />}
          title="Valor Total do Potencial"
          value={formatCurrencyBRL(stats?.totalPotencial || 0)}
          color="green"
        />
        <SummaryCard
          icon={<FilePlus size={24} />}
          title="Quantidade Total de Itens"
          value={stats?.totalCount || 0}
          color="blue"
        />
        <SummaryCard
          icon={<Users size={24} />}
          title="Novos Itens no Mês"
          value={stats?.newItemsThisMonth || 0}
          color="purple"
        />
      </div>

      {/* Gráficos/Métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Potencial por Responsável */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Potencial por Responsável</h3>
          <div className="space-y-3">
            {stats?.potencialPorResponsavel?.slice(0, 5).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">{item.responsavel}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-[var(--bg-secondary)] rounded-full h-2">
                    <div 
                      className="bg-[var(--accent-color)] h-2 rounded-full"
                      style={{ 
                        width: `${stats.potencialPorResponsavel[0]?.total ? (item.total / stats.potencialPorResponsavel[0].total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] w-24 text-right">
                    {formatCurrencyBRL(item.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Potencial por Fase */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Potencial por Fase</h3>
          <div className="space-y-3">
            {stats?.potencialPorFase?.map((item: any, idx: number) => {
              const faseNome = FASES_FUNIL.find(f => f.id === item.fase)?.nome;
              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{faseNome}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-[var(--bg-secondary)] rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.fase <= 3 ? 'bg-yellow-500' :
                          item.fase <= 5 ? 'bg-blue-500' :
                          item.fase === 8 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${stats.potencialPorFase.reduce((max: any, i: any) => Math.max(max, i.total), 0) ? (item.total / stats.potencialPorFase.reduce((max: any, i: any) => Math.max(max, i.total), 0)) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)] w-24 text-right">
                      {formatCurrencyBRL(item.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela Agrupada por Fase */}
      <div className="space-y-6">
        {funisPorFase.map(fase => (
          <div key={fase.id} className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
            {/* Resumo do Grupo */}
            <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    fase.id <= 3 ? 'bg-yellow-100 text-yellow-800' :
                    fase.id <= 5 ? 'bg-blue-100 text-blue-800' :
                    fase.id === 8 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {fase.nome}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {fase.count} {fase.count === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Total: {formatCurrencyBRL(fase.totalPotencial)}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    SLA Médio: {fase.slaMedio} dias
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Negócio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Responsável</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Nome Fantasia</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Regional</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Potencial</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">SLA</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Histórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {fase.funis.map(funil => (
                    <tr key={funil.id} className="hover:bg-[var(--bg-secondary)]">
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{funil.lumiax_genomica }</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.responsavel}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.nome_fantasia || funil.razao_social || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.regional || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-[var(--text-primary)]">
                        {formatCurrencyBRL(funil.potencial)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-[var(--text-secondary)]">
                        {calculateSLA(funil.data_criacao, funil.fase)} dias
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setSelectedHistorico(funil)}
                          className="p-2 hover:bg-[var(--border-color)] rounded-lg transition-colors"
                          title="Ver histórico"
                        >
                          <History size={16} className="text-[var(--text-secondary)]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Histórico */}
      {selectedHistorico && (
        <Modal
          isOpen={!!selectedHistorico}
          onClose={() => setSelectedHistorico(null)}
          title={`Histórico - ${selectedHistorico.lumiax_genomica }`}
        >
          <div className="space-y-4">
            {selectedHistorico.observacoes && selectedHistorico.observacoes.length > 0 ? (
              selectedHistorico.observacoes.map((obs: any) => (
                <div key={obs.id} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">
                    [{formatDate(obs.data)}]
                  </p>
                  <p className="text-sm text-[var(--text-primary)]">{obs.observacao}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-[var(--text-secondary)] py-8">
                Nenhuma observação registrada
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: 'green' | 'blue' | 'purple';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, title, value, color }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6 flex items-center gap-4">
      <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
};
