// The Electron sandbox loads this file as CommonJS, even though the app uses ES modules.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Regionais
  getRegionais: () => ipcRenderer.invoke('regionais:getAll'),
  importRegionais: (regionais: any[]) => ipcRenderer.invoke('regionais:import', regionais),

  // Funil
  getFunil: () => ipcRenderer.invoke('funil:getAll'),
  getFunilById: (id: number) => ipcRenderer.invoke('funil:getById', id),
  insertFunil: (funil: any) => ipcRenderer.invoke('funil:insert', funil),
  updateFunil: (id: number, funil: any) => ipcRenderer.invoke('funil:update', id, funil),
  updateFunilPhase: (id: number, fase: number) => ipcRenderer.invoke('funil:updatePhase', id, fase),
  deleteFunil: (id: number) => ipcRenderer.invoke('funil:delete', id),
  deleteFunis: (ids: number[]) => ipcRenderer.invoke('funil:deleteMany', ids),
  importFunis: (funis: any[]) => ipcRenderer.invoke('funil:import', funis),
  importObservacoes: (observacoes: any[]) => ipcRenderer.invoke('observacoes:import', observacoes),
  getSystemHealthMetrics: () => ipcRenderer.invoke('systemHealth:getMetrics'),

  // Observacoes
  addObservacao: (funilId: number, observacao: string, data?: string) => 
    ipcRenderer.invoke('observacoes:add', funilId, observacao, data),
});

export type ElectronAPI = typeof window.electronAPI;
