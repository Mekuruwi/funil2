import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { FASES_FUNIL } from '../types';
import { Regional } from '../types';

interface FunilFormData {
  responsavel: string;
  negocio: string;
  id_cliente: string;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  executivo: string;
  potencial: string;
  fase: string;
  ticket: string;
}

interface FunilFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  regionais: Regional[];
  editingFunil: any | null;
}

// Lista fixa de responsáveis (pode ser dinâmica no futuro)
const RESPONSAVEIS_LIST = [
  'Matheus',
  'Simony',
];

// Lista fixa de negócios (pode ser dinâmica no futuro)
const NEGOCIOS_LIST = [
  'Lumiax',
  'Genomica',
];

// Lista fixa de executivos (pode vir da tabela regionais)
const EXECUTIVOS_LIST = [
  'selecione...',
];

export const FunilFormModal: React.FC<FunilFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  regionais,
  editingFunil,
}) => {
  const [formData, setFormData] = useState<FunilFormData>({
    responsavel: '',
    negocio: '',
    id_cliente: '',
    cnpj: '',
    nome_fantasia: '',
    razao_social: '',
    executivo: '',
    potencial: '',
    fase: '2', // Valor padrão: 2. Proposta
    ticket: '',
  });

  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Regional | null>(null);

  // Extrair valor numérico do formato de moeda
  const parseCurrency = (formattedValue: string): string => {
    return formattedValue.replace(/\D/g, '');
  };

  useEffect(() => {
    if (editingFunil) {
      const regional = regionais.find(r => r.id === editingFunil.id_cliente);
      setFormData({
        responsavel: editingFunil.responsavel || '',
        negocio: editingFunil.negocio || '',
        id_cliente: editingFunil.id_cliente?.toString() || '',
        cnpj: regional?.cnpj || editingFunil.cnpj || '',
        nome_fantasia: regional?.nome_fantasia || editingFunil.nome_fantasia || '',
        razao_social: regional?.razao_social || editingFunil.razao_social || '',
        executivo: regional?.executivo || editingFunil.executivo || '',
        potencial: editingFunil.potencial?.toString() || '',
        fase: editingFunil.fase?.toString() || '2',
        ticket: editingFunil.ticket?.toString() || '',
      });
      setClienteEncontrado(regional || null);
    } else {
      setFormData({
        responsavel: '',
        negocio: '',
        id_cliente: '',
        cnpj: '',
        nome_fantasia: '',
        razao_social: '',
        executivo: '',
        potencial: '',
        fase: '2',
        ticket: '',
      });
      setClienteEncontrado(null);
    }
  }, [editingFunil, isOpen, regionais]);

  // Buscar dados do cliente na API BrasilAPI pelo CNPJ
  const buscarCNPJ = async () => {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      alert('CNPJ deve ter 14 dígitos');
      return;
    }

    setIsSearchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      
      if (!response.ok) {
        throw new Error('CNPJ não encontrado');
      }

      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        cnpj: data.cnpj || cnpjLimpo,
      }));
      
      setClienteEncontrado({
        id: 0,
        carteira: '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        razao_social: data.razao_social || '',
        cnpj: data.cnpj || cnpjLimpo,
        executivo: '',
        regional: '',
        coordenador: '',
        gerente: '',
      });
    } catch (error) {
      alert('Não foi possível buscar os dados do CNPJ. Preencha manualmente.');
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  // Auto-preenchimento quando ID é alterado
  useEffect(() => {
    if (formData.id_cliente) {
      const regional = regionais.find(r => r.id === parseInt(formData.id_cliente));
      if (regional) {
        setClienteEncontrado(regional);
        setFormData(prev => ({
          ...prev,
          cnpj: regional.cnpj,
          nome_fantasia: regional.nome_fantasia || regional.razao_social,
          razao_social: regional.razao_social,
          executivo: regional.executivo,
        }));
      } else {
        setClienteEncontrado(null);
      }
    } else {
      setClienteEncontrado(null);
    }
  }, [formData.id_cliente, regionais]);

  const handlePotencialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrency(value);
    
    setFormData(prev => ({
      ...prev,
      potencial: numericValue, // Armazena apenas o valor numérico
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      responsavel: formData.responsavel,
      negocio: formData.negocio,
      id_cliente: parseInt(formData.id_cliente) || 0,
      cnpj: formData.cnpj,
      nome_fantasia: formData.nome_fantasia || formData.razao_social,
      razao_social: formData.razao_social,
      executivo: formData.executivo,
      potencial: parseInt(formData.potencial) || 0,
      fase: parseInt(formData.fase),
      ticket: parseInt(formData.ticket) || 0,
    });
  };

  const displayPotencial = formData.potencial 
    ? (parseInt(formData.potencial) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingFunil ? 'Editar Registro' : 'Novo Registro'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
        {/* Seção 1: Dados Principais */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--accent-color)] uppercase tracking-wide border-b border-[var(--border-color)] pb-2">
            Dados do Negócio
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável - Lista */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Responsável *
              </label>
              <select
                required
                value={formData.responsavel}
                onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
              >
                <option value="">Selecione...</option>
                {RESPONSAVEIS_LIST.map(resp => (
                  <option key={resp} value={resp}>{resp}</option>
                ))}
              </select>
            </div>

            {/* Negócio - Lista */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Negócio *
              </label>
              <select
                required
                value={formData.negocio}
                onChange={(e) => setFormData(prev => ({ ...prev, negocio: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
              >
                <option value="">Selecione...</option>
                {NEGOCIOS_LIST.map(neg => (
                  <option key={neg} value={neg}>{neg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* ID Cliente */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                ID Cliente *
              </label>
              <input
                type="number"
                required
                value={formData.id_cliente}
                onChange={(e) => setFormData(prev => ({ ...prev, id_cliente: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                placeholder="Digite o ID"
              />
            </div>

            {/* Ticket */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Ticket *
              </label>
              <input
                type="number"
                required
                value={formData.ticket}
                onChange={(e) => setFormData(prev => ({ ...prev, ticket: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                placeholder="0"
              />
            </div>

            {/* Fase - Lista com padrão 2 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Fase *
              </label>
              <select
                required
                value={formData.fase}
                onChange={(e) => setFormData(prev => ({ ...prev, fase: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
              >
                {FASES_FUNIL.map(fase => (
                  <option key={fase.id} value={fase.id}>
                    {fase.id}. {fase.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CNPJ com botão de busca */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              CNPJ *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.cnpj}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              <button
                type="button"
                onClick={buscarCNPJ}
                disabled={isSearchingCNPJ || formData.cnpj.length < 14}
                className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {isSearchingCNPJ ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
                Buscar
              </button>
            </div>
          </div>

          {/* Nome Fantasia e Razão Social */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={formData.nome_fantasia}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                placeholder={formData.razao_social || 'Será preenchido com Razão Social se vazio'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Razão Social *
              </label>
              <input
                type="text"
                required
                value={formData.razao_social}
                onChange={(e) => setFormData(prev => ({ ...prev, razao_social: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Executivo - Lista */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Executivo *
            </label>
            <select
              required
              value={formData.executivo}
              onChange={(e) => setFormData(prev => ({ ...prev, executivo: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
            >
              <option value="">Selecione...</option>
              {EXECUTIVOS_LIST.map(exec => (
                <option key={exec} value={exec}>{exec}</option>
              ))}
            </select>
          </div>

          {/* Potencial - Formato Moeda */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Potencial (R$) *
            </label>
            <input
              type="text"
              required
              value={displayPotencial}
              onChange={handlePotencialChange}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all font-mono"
              placeholder="R$ 0,00"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Digite apenas números. Ex: 100000 = R$ 1.000,00
            </p>
          </div>
        </div>

        {/* Dados do Cliente (Auto-preenchidos) */}
        {clienteEncontrado && (
          <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--accent-color)] uppercase tracking-wide">
              Dados do Cliente (Auto-preenchido via ID ou CNPJ)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.cnpj || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.nome_fantasia || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Razão Social
              </label>
              <input
                type="text"
                disabled
                value={clienteEncontrado.razao_social || ''}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Carteira
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.carteira || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Regional
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.regional || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Coordenador
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.coordenador || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Gerente
                </label>
                <input
                  type="text"
                  disabled
                  value={clienteEncontrado.gerente || ''}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] cursor-not-allowed opacity-70"
                />
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg shadow-[var(--accent-color)]/25"
          >
            {editingFunil ? 'Salvar Alterações' : 'Criar Registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
