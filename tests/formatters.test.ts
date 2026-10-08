import { describe, expect, it, vi } from 'vitest';
import {
  calculateSLA,
  formatCNPJ,
  formatCurrencyBRL,
  formatDate,
} from '../src/utils/formatters';

describe('formatters', () => {
  it('formats Brazilian currency and CNPJ', () => {
    expect(formatCurrencyBRL(1234.5)).toContain('1.234,50');
    expect(formatCNPJ('12345678000199')).toBe('12.345.678/0001-99');
    expect(formatCNPJ('123')).toBe('123');
    expect(formatCNPJ('')).toBe('');
  });

  it('returns an empty date for empty input and formats valid dates', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('2025-02-03T12:00:00.000Z')).toContain('03/02/2025');
  });

  it('calculates elapsed calendar days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-04T12:00:00.000Z'));

    expect(calculateSLA('2025-02-03T12:00:00.000Z')).toBe(1);
    expect(calculateSLA('2025-02-04T00:00:00.000Z')).toBe(1);

    vi.useRealTimers();
  });
});
