import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Regionais
  getRegionais: () => ipcRenderer.invoke('regionais:getAll'),
  getRegionalById: (id: number) => ipcRenderer.invoke('regionais:getById', id),
  insertRegional: (regional: any) => ipcRenderer.invoke('regionais:insert', regional),
  updateRegional: (id: number, regional: any) => ipcRenderer.invoke('regionais:update', id, regional),
  deleteRegional: (id: number) => ipcRenderer.invoke('regionais:delete', id),
  clearRegionais: () => ipcRenderer.invoke('regionais:clear'),

  // Funil
  getFunil: () => ipcRenderer.invoke('funil:getAll'),
  getFunilById: (id: number) => ipcRenderer.invoke('funil:getById', id),
  insertFunil: (funil: any) => ipcRenderer.invoke('funil:insert', funil),
  updateFunil: (id: number, funil: any) => ipcRenderer.invoke('funil:update', id, funil),
  deleteFunil: (id: number) => ipcRenderer.invoke('funil:delete', id),

  // Observacoes
  addObservacao: (funilId: number, observacao: string) => 
    ipcRenderer.invoke('observacoes:add', funilId, observacao),
  getObservacoesByFunilId: (funilId: number) => 
    ipcRenderer.invoke('observacoes:getByFunilId', funilId),

  // Dashboard
  getDashboardStats: (filters: any) => ipcRenderer.invoke('dashboard:getStats', filters),
});

export type ElectronAPI = typeof window.electronAPI;
