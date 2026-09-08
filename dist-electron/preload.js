import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // Regionais
  getRegionais: () => ipcRenderer.invoke("regionais:getAll"),
  getRegionalById: (id) => ipcRenderer.invoke("regionais:getById", id),
  insertRegional: (regional) => ipcRenderer.invoke("regionais:insert", regional),
  updateRegional: (id, regional) => ipcRenderer.invoke("regionais:update", id, regional),
  deleteRegional: (id) => ipcRenderer.invoke("regionais:delete", id),
  // Funil
  getFunil: () => ipcRenderer.invoke("funil:getAll"),
  getFunilById: (id) => ipcRenderer.invoke("funil:getById", id),
  insertFunil: (funil) => ipcRenderer.invoke("funil:insert", funil),
  updateFunil: (id, funil) => ipcRenderer.invoke("funil:update", id, funil),
  deleteFunil: (id) => ipcRenderer.invoke("funil:delete", id),
  // Observacoes
  addObservacao: (funilId, observacao) => ipcRenderer.invoke("observacoes:add", funilId, observacao),
  getObservacoesByFunilId: (funilId) => ipcRenderer.invoke("observacoes:getByFunilId", funilId),
  // Dashboard
  getDashboardStats: (filters) => ipcRenderer.invoke("dashboard:getStats", filters)
});
