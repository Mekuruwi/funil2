import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFunilStore } from '../src/store/funilStore';

const funil = { id: 1, fase: 2, observacoes: [] };

describe('funil store', () => {
  const api = {
    getFunil: vi.fn(),
    getRegionais: vi.fn(),
    insertFunil: vi.fn(),
    getFunilById: vi.fn(),
    updateFunil: vi.fn(),
    updateFunilPhase: vi.fn(),
    deleteFunil: vi.fn(),
    deleteFunis: vi.fn(),
    addObservacao: vi.fn(),
    logError: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal('window', { electronAPI: api });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.getFunil.mockResolvedValue([funil]);
    api.getRegionais.mockResolvedValue([]);
    api.insertFunil.mockResolvedValue(1);
    api.getFunilById.mockResolvedValue(funil);
    api.updateFunil.mockResolvedValue(true);
    api.updateFunilPhase.mockResolvedValue(true);
    api.deleteFunil.mockResolvedValue(true);
    api.deleteFunis.mockResolvedValue(1);
    api.addObservacao.mockResolvedValue(9);
    api.logError.mockResolvedValue(undefined);
    useFunilStore.setState({
      funis: [],
      regionais: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads and creates records while keeping the store synchronized', async () => {
    await useFunilStore.getState().fetchFunis();
    expect(useFunilStore.getState().funis).toEqual([funil]);

    await useFunilStore.getState().addFunil({ cnpj: '123' });
    expect(api.insertFunil).toHaveBeenCalledWith({ cnpj: '123' });
    expect(useFunilStore.getState().funis).toEqual([funil, funil]);
  });

  it('updates phases, removes selected records, and appends observations', async () => {
    await useFunilStore.getState().fetchFunis();
    await useFunilStore.getState().fetchRegionais();
    expect(useFunilStore.getState().regionais).toEqual([]);

    await useFunilStore.getState().updateFunilPhase(1, 3);
    expect(useFunilStore.getState().funis[0].fase).toBe(3);

    await useFunilStore.getState().addObservacao(1, 'Contato realizado');
    expect(useFunilStore.getState().funis[0].observacoes?.[0]).toMatchObject({
      id: 9,
      funil_id: 1,
      observacao: 'Contato realizado',
    });

    await useFunilStore.getState().deleteFunis([1]);
    expect(useFunilStore.getState().funis).toEqual([]);
  });

  it('updates a record and removes it individually', async () => {
    await useFunilStore.getState().fetchFunis();

    await useFunilStore.getState().updateFunil(1, { fase: 3 });
    expect(api.updateFunil).toHaveBeenCalledWith(1, { fase: 3 });

    await useFunilStore.getState().deleteFunil(1);
    expect(api.deleteFunil).toHaveBeenCalledWith(1);
    expect(useFunilStore.getState().funis).toEqual([]);
  });

  it('surfaces fetch failures through store state and the logger', async () => {
    api.getFunil.mockRejectedValueOnce(new Error('Database unavailable'));

    await useFunilStore.getState().fetchFunis();

    expect(useFunilStore.getState().error).toBe('Erro ao buscar funis');
    expect(api.logError).toHaveBeenCalledWith(
      'Falha ao carregar funis',
      'Database unavailable',
      expect.any(String),
    );
  });
});
