import React, { useState } from 'react';
import { formatCurrencyBRL, formatDate, formatCNPJ } from '../utils/formatters';
import { FunilWithDetails } from '../types';
import { FASES_FUNIL } from '../types';
import { ChevronDown, ChevronUp, User, Tag, MapPin, Building2, FileText } from 'lucide-react';

interface FunilCardProps {
  funil: FunilWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPhaseChange: (fase: number) => Promise<void>;
  selected: boolean;
  onSelect: () => void;
  onAddObservation: (text: string, date: string) => Promise<void>;
  onGenerateDocuments: () => void;
}

const FunilCardComponent: React.FC<FunilCardProps> = ({
  funil,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onPhaseChange,
  selected,
  onSelect,
  onAddObservation,
  onGenerateDocuments,
}) => {
  const formatObservationDate = (value: string) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : formatDate(value).slice(0, 10);
  };

  const [observationText, setObservationText] = useState('');
  const [observationDate, setObservationDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingObservation, setSavingObservation] = useState(false);
  // Mapeia a fase string para o ID numérico
  const getFaseId = (faseStr: string): number => {
    const numericPhase = Number(faseStr);
    if (Number.isInteger(numericPhase) && numericPhase >= 1 && numericPhase <= 8) {
      return numericPhase;
    }
    if (faseStr.includes('Mapeamento')) return 1;
    if (faseStr.includes('Proposta')) return 2;
    if (faseStr.includes('Negociação')) return 3;
    if (faseStr.includes('Contrato')) return 4;
    if (faseStr.includes('Implantação')) return 5;
    if (faseStr.includes('Acompanhamento')) return 6;
    if (faseStr.includes('Declinou')) return 7;
    if (faseStr.includes('Concluido') || faseStr.includes('Concluído')) return 8;
    return 1;
  };
  
  const faseId = getFaseId(String(funil.fase));

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden transition-all duration-200">
      {/* Card Header - Always Visible */}
      <div 
        className="px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-secondary)]"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 bg-[var(--accent-color)] text-white text-[11px] rounded font-medium">
                Ticket: {funil.ticket_onboarding || 'N/A'}
              </span>
              <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${
                faseId <= 3 ? 'bg-yellow-100 text-yellow-800' :
                faseId <= 5 ? 'bg-blue-100 text-blue-800' :
                faseId === 8 ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {FASES_FUNIL.find(fase => fase.id === faseId)?.nome || funil.fase}
              </span>
            </div>

            <h3 className="text-base font-semibold text-[var(--text-primary)] leading-snug truncate">
              {funil.razao_social || funil.nome_fantasia || 'Cliente não encontrado'}
            </h3>

            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {funil.nome_fantasia || 'Sem nome fantasia'} <span className="mx-1">·</span> CNPJ: {formatCNPJ(funil.cnpj || '')}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-base font-bold text-[var(--accent-color)] whitespace-nowrap">
              {formatCurrencyBRL(funil.potencial)}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1">
              <label
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                onClick={(event) => event.stopPropagation()}
                title="Selecionar card"
              >
                <input
                  aria-label="Selecionar card"
                  type="checkbox"
                  checked={selected}
                  onChange={onSelect}
                  className="m-0 h-4 w-4 cursor-pointer accent-[var(--accent-color)]"
                />
              </label>
              <button
                type="button"
                aria-label={isExpanded ? 'Recolher card' : 'Expandir card'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle();
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <DetailItem 
              icon={<User size={16} />}
              label="Responsável"
              value={funil.responsavel || '-'}
            />
            <DetailItem 
              icon={<Tag size={16} />}
              label="Ticket Onboarding"
              value={funil.ticket_onboarding || '-'}
            />
            <DetailItem 
              icon={<Building2 size={16} />}
              label="Regional"
              value={funil.regional_cruzada || funil.regional || '-'}
            />
            <DetailItem 
              icon={<MapPin size={16} />}
              label="Carteira"
              value={funil.carteira_cruzada || funil.carteira || '-'}
            />
            <DetailItem 
              icon={<User size={16} />}
              label="Executivo"
              value={funil.ev || funil.executivo_regional || '-'}
            />
            <DetailItem 
              icon={<User size={16} />}
              label="Coordenador"
              value={funil.coordenador || '-'}
            />
            <DetailItem 
              icon={<User size={16} />}
              label="Gerente"
              value={funil.gerente || '-'}
            />
          </div>

          {/* Observações */}
          {funil.observacoes && funil.observacoes.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                Histórico de Observações
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {funil.observacoes.map((obs) => (
                  <div 
                    key={obs.id}
                    className="px-2 py-1.5 bg-[var(--bg-primary)] rounded text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {formatObservationDate(obs.data)} -
                    </span>
                    <span className="text-[var(--text-primary)] ml-2">
                      {obs.observacao}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <form className="mt-3 flex flex-col md:flex-row gap-2" onSubmit={async (event) => {
            event.preventDefault();
            if (!observationText.trim() || savingObservation) return;
            setSavingObservation(true);
            try {
              await onAddObservation(observationText.trim(), observationDate);
              setObservationText('');
            } finally {
              setSavingObservation(false);
            }
          }}>
            <input type="date" value={observationDate} onChange={(event) => setObservationDate(event.target.value)} className="px-2.5 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
            <input type="text" value={observationText} onChange={(event) => setObservationText(event.target.value)} placeholder="Nova observação" className="flex-1 px-2.5 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]" />
            <button type="submit" disabled={savingObservation || !observationText.trim()} className="px-3 py-1.5 rounded-lg bg-[var(--accent-color)] text-sm text-white disabled:opacity-50">{savingObservation ? 'Salvando...' : 'Adicionar'}</button>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor={`fase-${funil.id}`}>
              Fase
            </label>
            <select
              id={`fase-${funil.id}`}
              value={faseId}
              onChange={(e) => {
                e.stopPropagation();
                void onPhaseChange(Number(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
            >
              {FASES_FUNIL.map(fase => (
                <option key={fase.id} value={fase.id}>{fase.id}. {fase.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-color)]">
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateDocuments(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)]"
            >
              <FileText size={16} /> Gerar documentos
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="px-3 py-1.5 text-sm bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Cards fechados não precisam renderizar novamente quando outro card é expandido.
export const FunilCard = React.memo(FunilCardComponent);

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2">
    <span className="text-[var(--text-secondary)] mt-0.5">{icon}</span>
    <div>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  </div>
);
