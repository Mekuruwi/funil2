import { read, utils, writeFile } from 'xlsx';

export interface ImportResult {
  success: boolean;
  data?: any[];
  error?: string;
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
    const jsonData = utils.sheet_to_json(worksheet);
    
    return { success: true, data: jsonData };
  } catch (error) {
    console.error('Erro ao ler arquivo Excel:', error);
    return { 
      success: false, 
      error: 'Falha ao processar arquivo. Verifique o formato.' 
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
 */
export const validateRegionaisData = (data: any[]): any[] => {
  return data.map(row => {
    // Tenta encontrar o CNPJ em várias variações de nome de coluna
    const rawCnpj = row.cnpj || row.CNPJ || row['Cnpj'] || row['cnpj'] || '';
    
    return {
      id: row.id || row.ID || row['ID'] || null,
      ent_id_sap: row.ent_id_sap || row['ent_id_sap'] || row['ENT_ID_SAP'] || null,
      cnpj: cleanCNPJ(rawCnpj),
      raiz: row.raiz || row.RAIZ || row['Raiz'] || '',
      nome_cliente: row.nome_cliente || row.NOME_CLIENTE || row['Nome Cliente'] || row['NOMECLIENTE'] || '',
      desc_representante: row.desc_representante || row.DESC_REPRESENTANTE || row['Desc Representante'] || row['DESCREPRESENTANTE'] || '',
      desc_regional_matriz: row.desc_regional_matriz || row.DESC_REGIONAL_MATRIZ || row['Desc Regional Matriz'] || row['DESCREGIONALMATRIZ'] || '',
      executivo: row.executivo || row.EXECUTIVO || row['Executivo'] || row['EXECUTIVO'] || '',
      email: row.EMAIL || row.email || row['Email'] || row['email'] || '',
      nome_coordenador: row.NOME_COORDENADOR || row.nome_coordenador || row['Nome Coordenador'] || row['NOMECORDENADOR'] || '',
    };
  }).filter(row => {
    // Filtra linhas vazias - considera válido se tiver CNPJ OU nome_cliente OU id
    return row.cnpj || row.nome_cliente || row.id;
  });
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
