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
 * Valida e normaliza dados de regionais importados
 */
export const validateRegionaisData = (data: any[]): any[] => {
  return data.map(row => ({
    carteira: row.carteira || row.Carteira || '',
    nome_fantasia: row.nome_fantasia || row.Nome_Fantasia || row['Nome Fantasia'] || '',
    razao_social: row.razao_social || row.Razao_Social || row['Razão Social'] || '',
    cnpj: row.cnpj || row.CNPJ || '',
    executivo: row.executivo || row.Executivo || '',
    regional: row.regional || row.Regional || '',
    coordenador: row.coordenador || row.Coordenador || '',
    gerente: row.gerente || row.Gerente || '',
  })).filter(row => row.carteira || row.cnpj); // Filtra linhas vazias
};

/**
 * Prepara dados para inserção em lote no banco
 */
export const prepareBatchInsert = (data: any[], tableName: string): string => {
  if (data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  const values = data.map(row => 
    `(${columns.map(col => {
      const val = row[col];
      return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val || 'NULL';
    }).join(', ')})`
  ).join(', ');
  
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
};
