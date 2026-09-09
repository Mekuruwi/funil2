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
