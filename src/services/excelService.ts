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
 * Valida e normaliza dados de regionais importados no formato esperado:
 * id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, EMAIL, NOME_COORDENADOR
 */
export const validateRegionaisData = (data: any[]): any[] => {
  return data.map(row => ({
    ent_id_sap: row.ent_id_sap || row['ent_id_sap'] || null,
    cnpj: row.cnpj || row.CNPJ || '',
    raiz: row.raiz || row.RAIZ || '',
    nome_cliente: row.nome_cliente || row.NOME_CLIENTE || row['Nome Cliente'] || '',
    desc_representante: row.desc_representante || row.DESC_REPRESENTANTE || row['Desc Representante'] || '',
    desc_regional_matriz: row.desc_regional_matriz || row.DESC_REGIONAL_MATRIZ || row['Desc Regional Matriz'] || '',
    executivo: row.executivo || row.EXECUTIVO || row['Executivo'] || '',
    email: row.EMAIL || row.email || row['Email'] || '',
    nome_coordenador: row.NOME_COORDENADOR || row.nome_coordenador || row['Nome Coordenador'] || '',
  })).filter(row => row.cnpj || row.nome_cliente); // Filtra linhas vazias
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
