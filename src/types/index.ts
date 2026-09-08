export interface Regional {
  id: number;
  carteira: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  executivo: string;
  regional: string;
  coordenador: string;
  gerente: string;
}

export interface Funil {
  id: number;
  ticket: number;
  negocio: string;
  id_cliente: number;
  potencial: number;
  fase: number;
  responsavel: string;
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
  nome_fantasia?: string;
  razao_social?: string;
  cnpj?: string;
  carteira?: string;
  executivo?: string;
  regional?: string;
  coordenador?: string;
  gerente?: string;
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
