import { read, utils, writeFile } from 'xlsx';

export interface ImportResult {
  success: boolean;
  data?: any[];
  error?: string;
  detailedErrors?: string[];
}

/**
 * Lê um arquivo Excel/CSV e retorna os dados como array de objetos
 */
export const readExcelFile = async (file: File): Promise<ImportResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = utils.sheet_to_json(worksheet, { defval: '' });
    
    if (!jsonData || jsonData.length === 0) {
      return { 
        success: false, 
        error: 'Arquivo vazio ou sem dados válidos',
        detailedErrors: ['O arquivo não contém nenhuma linha de dados']
      };
    }
    
    // Extrai nomes das colunas para debug
    const headers = Object.keys(jsonData[0] as object);
    console.log('Colunas encontradas no arquivo:', headers);
    
    return { success: true, data: jsonData, detailedErrors: [] };
  } catch (error) {
    console.error('Erro ao ler arquivo Excel:', error);
    return { 
      success: false, 
      error: 'Falha ao processar arquivo. Verifique o formato.',
      detailedErrors: [`Erro técnico: ${(error as Error).message}`]
    };
  }
};

/**
 * Exporta dados para arquivo Excel
 */
export const exportToExcel = (data: any[], fileName: string = 'export.xlsx'): void => {
  try {
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Dados');
    writeFile(workbook, fileName);
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
  }
};

export const downloadObservacoesTemplate = (): void => {
  exportToExcel([
    { CNPJ: '00000000000000', Data: '2026-09-14', Observacao: 'Exemplo de nova observação' },
  ], 'modelo-atualizacao-observacoes.xlsx');
};

/**
 * Remove formatação de CNPJ (pontos, traços, barras e espaços)
 */
const cleanCNPJ = (cnpj: any): string => {
  if (!cnpj) return '';
  return String(cnpj).replace(/[^\d]/g, '');
};

/**
 * Valida e normaliza dados de regionais importados no formato esperado:
 * id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, EMAIL, NOME_COORDENADOR
 * Retorna dados validados e erros detalhados para debug
 */
export const validateRegionaisData = (data: any[]): { validData: any[], errors: string[] } => {
  const validData: any[] = [];
  const errors: string[] = [];
  
  if (!data || data.length === 0) {
    return { validData: [], errors: ['Nenhum dado fornecido para validação'] };
  }
  
  // Extrai colunas disponíveis na primeira linha para referência
  const availableColumns = Object.keys(data[0]);
  console.log('Colunas disponíveis no arquivo:', availableColumns);
  
  data.forEach((row, index) => {
    const rowNumber = index + 2; // +2 porque índice 0 é cabeçalho e array começa em 0
    
    // Pula linhas completamente vazias
    if (Object.values(row).every(val => val === '' || val === null || val === undefined)) {
      return;
    }
    
    // Tenta encontrar o CNPJ em várias variações de nome de coluna
    const rawCnpj = row.cnpj || row.CNPJ || row['Cnpj'] || row['cnpj'] || '';
    
    const validatedRow = {
      id: row.id || row.ID || row['ID'] || null,
      ent_id_sap: row.ent_id_sap || row['ent_id_sap'] || row['ENT_ID_SAP'] || null,
      cnpj: cleanCNPJ(rawCnpj),
      raiz: row.raiz || row.RAIZ || row['Raiz'] || '',
      nome_cliente: row.nome_cliente || row.NOME_CLIENTE || row['Nome Cliente'] || row['NOMECLIENTE'] || '',
      desc_representante: row.desc_representante || row.DESC_REPRESENTANTE || row['Desc Representante'] || row['DESCREPRESENTANTE'] || '',
      desc_regional_matriz: row.desc_regional_matriz || row.DESC_REGIONAL_MATRIZ || row['Desc Regional Matriz'] || row['DESCREGIONALMATRIZ'] || '',
      executivo: row.executivo || row.EXECUTIVO || row['Executivo'] || row['EXECUTIVO'] || '',
      email: row.EMAIL || row.email || row['Email'] || row['EMAIL'] || '',
      nome_coordenador: row.NOME_COORDENADOR || row.nome_coordenador || row['Nome Coordenador'] || row['NOMECORDENADOR'] || '',
    };
    
    // Verifica se a linha tem dados mínimos necessários
    if (!validatedRow.cnpj && !validatedRow.nome_cliente && !validatedRow.id) {
      errors.push(`Linha ${rowNumber}: Dados insuficientes - falta CNPJ, nome do cliente ou ID`);
      return;
    }
    
    validData.push(validatedRow);
  });
  
  return { validData, errors };
};

/**
 * Normaliza a planilha da base antiga para o formato da tabela funil.
 * A importação é adicionada aos registros existentes.
 */
export const normalizeBaseAntigaData = (data: any[]): { validData: any[], errors: string[] } => {
  const validData: any[] = [];
  const errors: string[] = [];
  const get = (row: any, column: string) => row[column] ?? '';
  const textValue = (value: any) => {
    if (value === '' || value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isInteger(value)) return String(value);
    return String(value).replace(/\.0+$/, '');
  };
  const numberOrNull = (value: any) => value === '' || value === null || value === undefined ? null : Number(value);
  const observationValue = (value: any) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const match = raw.match(/(?:^|\D)(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\D|$)/);
    if (!match) return '';
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const text = raw.replace(match[0], '').replace(/^[\s:-]+|[\s-]+$/g, '').trim();
    return text ? `${day}/${month}/${year} - ${text}` : '';
  };
  const historyValue = (value: any) => {
    const entries = String(value ?? '').split(/\r?\n/).map(line => {
      const match = line.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s*-\s*(.+)$/);
      if (!match) return '';
      return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]} - ${match[4].trim()}`;
    }).filter(Boolean);
    return entries.join('\n');
  };
  const phaseNumber = (value: any) => {
    const match = String(value ?? '').match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  };

  data.forEach((row, index) => {
    const rowNumber = index + 2;
    if (Object.values(row).every(value => value === '' || value === null || value === undefined)) return;

    const normalized = {
      lumiax_genomica: get(row, 'Lumiax/Genomica'),
      responsavel: get(row, 'Responsavel'),
      ticket_onboarding: textValue(get(row, 'Ticket onboarding')),
      id_cliente: numberOrNull(get(row, 'Id')) || null,
      cnpj: textValue(get(row, 'Cnpj')),
      razao_social: textValue(get(row, 'Razão Social')),
      nome_fantasia: textValue(get(row, 'Nome Fantasia')),
      uf: textValue(get(row, 'Uf')),
      regional: textValue(get(row, 'Regional')),
      ev: textValue(get(row, 'Ev')),
      carteira: textValue(get(row, 'Carteira')),
      coordenador: textValue(get(row, 'Coordenador')),
      gerente: textValue(get(row, 'Gerente')),
      potencial: numberOrNull(get(row, 'Potencial')) || 0,
      fase: phaseNumber(get(row, 'Fase')) || 1,
      entrada_mapeamento: textValue(get(row, 'Entrada (1. Mapeamento)')),
      saida_mapeamento: textValue(get(row, 'Saida (1. Mapeamento)')),
      sla_mapeamento: numberOrNull(get(row, 'SLA (1. Mapeamento)')),
      entrada_proposta: textValue(get(row, 'Entrada (2. Proposta)')),
      saida_proposta: textValue(get(row, 'Saida (2. Proposta)')),
      sla_proposta: numberOrNull(get(row, 'SLA (2. Proposta)')),
      entrada_negociacao: textValue(get(row, 'Entrada (3. Negociação)')),
      saida_negociacao: textValue(get(row, 'Saida (3. Negociação)')),
      sla_negociacao: numberOrNull(get(row, 'SLA (3. Negociação)')),
      entrada_contrato: textValue(get(row, 'Entrada (4. Contrato)')),
      saida_contrato: textValue(get(row, 'Saida (4. Contrato)')),
      sla_contrato: numberOrNull(get(row, 'SLA (4. Contrato)')),
      entrada_implantacao: textValue(get(row, 'Entrada (5. Implantação)')),
      saida_implantacao: textValue(get(row, 'Saida (5. Implantação)')),
      sla_implantacao: numberOrNull(get(row, 'SLA (5. Implantação)')),
      entrada_acompanhamento: textValue(get(row, 'Entrada (6. Acompanhamento (60Dias))')),
      saida_acompanhamento: textValue(get(row, 'Saida (6. Acompanhamento (60Dias))')),
      sla_acompanhamento: numberOrNull(get(row, 'SLA (6. Acompanhamento (60Dias))')),
      entrada_declinou: textValue(get(row, 'Entrada (7. Declinou)')),
      saida_declinou: textValue(get(row, 'Saida (7. Declinou)')),
      sla_declinou: numberOrNull(get(row, 'SLA (7. Declinou)')),
      entrada_concluido: textValue(get(row, 'Entrada (8. Concluido)')),
      saida_concluido: textValue(get(row, 'Saida (8. Concluido)')),
      sla_concluido: numberOrNull(get(row, 'SLA (8. Concluido)')),
      observacao: observationValue(get(row, 'Observação')),
      historico: historyValue(get(row, 'Historico')),
      selecionados: get(row, 'Selecionados'),
    };

    if (!normalized.razao_social && !normalized.nome_fantasia && !normalized.cnpj) {
      errors.push(`Linha ${rowNumber}: sem cliente, CNPJ ou razão social`);
      return;
    }
    validData.push(normalized);
  });

  const uniqueData = new Map<string, any>();
  validData.forEach(item => {
    const cnpj = String(item.cnpj || '').replace(/\D/g, '');
    const key = cnpj ? `cnpj:${cnpj}` : item.id_cliente ? `id:${item.id_cliente}` : '';
    if (key) uniqueData.set(key, item);
  });

  return { validData: uniqueData.size ? Array.from(uniqueData.values()) : validData, errors };
};

/**
 * Prepara dados para inserção em lote no banco de regionais
 */
export const prepareBatchInsert = (data: any[], tableName: string): string => {
  if (data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  const values = data.map(row => 
    `(${columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) {
        return 'NULL';
      }
      return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
    }).join(', ')})`
  ).join(', ');
  
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
};

/**
 * Limpa todos os registros da tabela de regionais (para operação slot - substitui tudo)
 */
export const clearRegionaisTable = (): string => {
  return 'DELETE FROM regionais';
};
