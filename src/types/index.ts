export interface Regional {
  id: number;
  ent_id_sap: number | null;
  cnpj: string;
  raiz: string;
  nome_cliente: string;
  desc_representante: string;
  desc_regional_matriz: string;
  executivo: string;
  email: string;
  nome_coordenador: string;
}

export interface Funil {
  id: number;
  lumiax_genomica: string;
  responsavel: string;
  ticket_onboarding: string;
  id_cliente: number;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  uf: string;
  regional: string;
  ev: string;
  carteira: string;
  coordenador: string;
  gerente: string;
  potencial: number;
  fase: number;
  entrada_mapeamento: string;
  saida_mapeamento: string;
  sla_mapeamento: number;
  entrada_proposta: string;
  saida_proposta: string;
  sla_proposta: number;
  entrada_negociacao: string;
  saida_negociacao: string;
  sla_negociacao: number;
  entrada_contrato: string;
  saida_contrato: string;
  sla_contrato: number;
  entrada_implantacao: string;
  saida_implantacao: string;
  sla_implantacao: number;
  entrada_acompanhamento: string;
  saida_acompanhamento: string;
  sla_acompanhamento: number;
  entrada_declinou: string;
  saida_declinou: string;
  sla_declinou: number;
  entrada_concluido: string;
  saida_concluido: string;
  sla_concluido: number;
  observacao: string;
  historico: string;
  selecionados: string;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Observacao {
  id: number;
  funil_id: number;
  data: string;
  observacao: string;
}

export interface FunilWithDetails extends Funil {
  nome_cliente?: string;
  desc_representante?: string;
  desc_regional_matriz?: string;
  executivo_regional?: string;
  coord_regional?: string;
  observacoes?: Observacao[];
}

export type Theme = 'light' | 'dark';

export const FASES_FUNIL = [
  { id: 1, nome: 'Mapeamento' },
  { id: 2, nome: 'Proposta' },
  { id: 3, nome: 'Negociação' },
  { id: 4, nome: 'Contrato' },
  { id: 5, nome: 'Implantação' },
  { id: 6, nome: 'Acompanhamento (60 Dias)' },
  { id: 7, nome: 'Declinou' },
  { id: 8, nome: 'Concluído' },
] as const;

export type FaseFunil = typeof FASES_FUNIL[number]['id'];
