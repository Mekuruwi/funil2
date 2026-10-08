import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRegionaisTable,
  normalizeBaseAntigaData,
  prepareBatchInsert,
  readExcelFile,
  validateRegionaisData,
} from '../src/services/excelService';
import { utils, write } from 'xlsx';

describe('excelService domain normalization', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('validates regional rows and reports rows without identifying data', () => {
    const result = validateRegionaisData([
      { CNPJ: '12.345.678/0001-99', 'Nome Cliente': 'Cliente A' },
      { CNPJ: '', 'Nome Cliente': '', ID: '', Extra: 'row data' },
      { CNPJ: '', 'Nome Cliente': '', ID: '', extra: '' },
    ]);

    expect(result.validData).toHaveLength(1);
    expect(result.validData[0].cnpj).toBe('12345678000199');
    expect(result.errors).toEqual([
      'Linha 3: Dados insuficientes - falta CNPJ, nome do cliente ou ID',
    ]);
  });

  it('normalizes legacy sales data and removes duplicate CNPJs', () => {
    const row = {
      'Lumiax/Genomica': 'Lumiax',
      Responsavel: 'Ana',
      Id: 42,
      Cnpj: '12.345.678/0001-99',
      'Razão Social': 'Empresa',
      Potencial: 1500,
      Fase: '3. Negociação',
      Observação: '03/02/2025 - Primeiro contato',
      Historico: '01/02/2025 - Lead recebido',
    };
    const result = normalizeBaseAntigaData([
      row,
      { ...row, Responsavel: 'Duplicado' },
      {
        Cnpj: '',
        'Razão Social': '',
        'Nome Fantasia': '',
        Responsavel: 'Sem cliente',
      },
    ]);

    expect(result.validData).toHaveLength(1);
    expect(result.validData[0]).toMatchObject({
      lumiax_genomica: 'Lumiax',
      responsavel: 'Duplicado',
      id_cliente: 42,
      fase: 3,
      potencial: 1500,
      observacao: '03/02/2025 - Primeiro contato',
      historico: '01/02/2025 - Lead recebido',
    });
    expect(result.errors).toHaveLength(1);
  });

  it('returns validation errors for missing input and builds safe SQL values', () => {
    expect(validateRegionaisData([]).errors).toEqual([
      'Nenhum dado fornecido para validação',
    ]);
    expect(
      normalizeBaseAntigaData([
        { 'Razão Social': '', 'Nome Fantasia': '', Cnpj: '' },
      ]).validData,
    ).toEqual([]);
    expect(prepareBatchInsert([], 'regionais')).toBe('');
    expect(
      prepareBatchInsert([{ nome: "O'Neil", ativo: null }], 'regionais'),
    ).toBe("INSERT INTO regionais (nome, ativo) VALUES ('O''Neil', NULL)");
    expect(clearRegionaisTable()).toBe('DELETE FROM regionais');
  });

  it('reads spreadsheet rows and reports empty or malformed files', async () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(
      workbook,
      utils.json_to_sheet([{ CNPJ: '123' }]),
      'Dados',
    );
    const bytes = write(workbook, { type: 'array', bookType: 'xlsx' });
    const file = new File([bytes], 'dados.xlsx');

    await expect(readExcelFile(file)).resolves.toMatchObject({
      success: true,
      data: [{ CNPJ: '123' }],
    });
    await expect(
      readExcelFile(new File([''], 'vazio.xlsx')),
    ).resolves.toMatchObject({ success: false });
  });
});
