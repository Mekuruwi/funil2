const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getRegionais: () => ipcRenderer.invoke('regionais:getAll'),
  importRegionais: (regionais) => ipcRenderer.invoke('regionais:import', regionais),
  getFunil: () => ipcRenderer.invoke('funil:getAll'),
  getFunilById: (id) => ipcRenderer.invoke('funil:getById', id),
  insertFunil: (funil) => ipcRenderer.invoke('funil:insert', funil),
  updateFunil: (id, funil) => ipcRenderer.invoke('funil:update', id, funil),
  updateFunilPhase: (id, fase) => ipcRenderer.invoke('funil:updatePhase', id, fase),
  deleteFunil: (id) => ipcRenderer.invoke('funil:delete', id),
  deleteFunis: (ids) => ipcRenderer.invoke('funil:deleteMany', ids),
  importFunis: (funis) => ipcRenderer.invoke('funil:import', funis),
  importObservacoes: (observacoes) => ipcRenderer.invoke('observacoes:import', observacoes),
  getSystemHealthMetrics: () => ipcRenderer.invoke('systemHealth:getMetrics'),
  addObservacao: (funilId, observacao, data) => ipcRenderer.invoke('observacoes:add', funilId, observacao, data),
});
