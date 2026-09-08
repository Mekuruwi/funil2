import React from 'react';
import { formatCurrencyBRL, formatDate, formatCNPJ } from '../utils/formatters';
import { FASES_FUNIL, FunilWithDetails } from '../types';
import { ChevronDown, ChevronUp, User, Tag, MapPin, Building2 } from 'lucide-react';

interface FunilCardProps {
  funil: FunilWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const FunilCard: React.FC<FunilCardProps> = ({
  funil,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const faseAtual = FASES_FUNIL.find(f => f.id === funil.fase);

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden transition-all duration-200">
      {/* Card Header - Always Visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-[var(--bg-secondary)]"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 bg-[var(--accent-color)] text-white text-xs rounded font-medium">
                ID: {funil.id_cliente}
              </span>
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                funil.fase <= 3 ? 'bg-yellow-100 text-yellow-800' :
                funil.fase <= 5 ? 'bg-blue-100 text-blue-800' :
                funil.fase === 8 ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {faseAtual?.nome || `Fase ${funil.fase}`}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              {funil.negocio}
            </h3>
            
            <p className="text-[var(--text-secondary)]">
              {funil.nome_fantasia || funil.razao_social || 'Cliente não encontrado'}
            </p>
            
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              CNPJ: {formatCNPJ(funil.cnpj || '')}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-xl font-bold text-[var(--accent-color)]">
              {formatCurrencyBRL(funil.potencial)}
            </p>
            <button className="mt-2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <DetailItem 
              icon={<User size={16} />}
              label="Responsável"
              value={funil.responsavel}
            />
            <DetailItem 
              icon={<Tag size={16} />}
              label="Ticket"
              value={funil.ticket.toString()}
            />
            <DetailItem 
              icon={<Building2 size={16} />}
              label="Regional"
              value={funil.regional || '-'}
            />
            <DetailItem 
              icon={<MapPin size={16} />}
              label="Carteira"
              value={funil.carteira || '-'}
            />
            <DetailItem 
              icon={<User size={16} />}
              label="Executivo"
              value={funil.executivo || '-'}
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
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                Histórico de Observações
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {funil.observacoes.map((obs) => (
                  <div 
                    key={obs.id}
                    className="p-2 bg-[var(--bg-primary)] rounded text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">
                      [{formatDate(obs.data)}]
                    </span>
                    <span className="text-[var(--text-primary)] ml-2">
                      {obs.observacao}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
