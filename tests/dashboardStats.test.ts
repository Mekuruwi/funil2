import { describe, expect, it } from 'vitest';
import {
  calculateDashboardStats,
  type DashboardRecord,
} from '../electron/domain/dashboardStats';

describe('dashboard statistics', () => {
  const funis: DashboardRecord[] = [
    {
      cnpj: '12.345.678/0001-90',
      lumiax_genomica: 'Lumiax',
      responsavel: 'Ana',
      ev: 'Carlos',
      carteira: 'Enterprise',
      fase: 2,
      potencial: 1000,
      data_criacao: '2026-10-05T10:00:00.000Z',
    },
    {
      cnpj: '12345678000190',
      lumiax_genomica: 'Genomica',
      responsavel: 'Beatriz',
      ev: 'Rita',
      carteira: 'SMB',
      regional: 'Norte',
      fase: 10,
      potencial: 500,
      data_criacao: '2026-09-30T10:00:00.000Z',
    },
  ];
  const regionais: DashboardRecord[] = [
    { cnpj: '12345678000190', desc_regional_matriz: 'Sul' },
  ];

  it('calculates totals and groups after normalizing regional CNPJs', () => {
    expect(
      calculateDashboardStats(
        funis,
        regionais,
        {},
        new Date('2026-10-12T12:00:00.000Z'),
      ),
    ).toEqual({
      totalPotencial: 1500,
      totalCount: 2,
      newItemsThisMonth: 1,
      potencialPorResponsavel: [
        { responsavel: 'Ana', total: 1000, count: 1 },
        { responsavel: 'Beatriz', total: 500, count: 1 },
      ],
      potencialPorFase: [
        { fase: '2', total: 1000, count: 1 },
        { fase: '10', total: 500, count: 1 },
      ],
    });
  });

  it('applies all filters and treats invalid potential values as zero', () => {
    const result = calculateDashboardStats(
      [...funis, { ...funis[0], responsavel: 'Ana', potencial: 'inválido' }],
      regionais,
      {
        negocio: 'LUMIAX',
        regional: 'su',
        fase: '2',
        responsavel: 'an',
        executivo: 'car',
        carteira: 'enter',
      },
      new Date('2026-10-12T12:00:00.000Z'),
    );

    expect(result.totalCount).toBe(2);
    expect(result.totalPotencial).toBe(1000);
    expect(result.newItemsThisMonth).toBe(2);
  });
});
