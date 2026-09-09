import { contextBridge as o, ipcRenderer as i } from "electron";
o.exposeInMainWorld("electronAPI", {
  // Regionais
  getRegionais: () => i.invoke("regionais:getAll"),
  getRegionalById: (e) => i.invoke("regionais:getById", e),
  insertRegional: (e) => i.invoke("regionais:insert", e),
  updateRegional: (e, n) => i.invoke("regionais:update", e, n),
  deleteRegional: (e) => i.invoke("regionais:delete", e),
  clearRegionais: () => i.invoke("regionais:clear"),
  // Funil
  getFunil: () => i.invoke("funil:getAll"),
  getFunilById: (e) => i.invoke("funil:getById", e),
  insertFunil: (e) => i.invoke("funil:insert", e),
  updateFunil: (e, n) => i.invoke("funil:update", e, n),
  deleteFunil: (e) => i.invoke("funil:delete", e),
  // Observacoes
  addObservacao: (e, n) => i.invoke("observacoes:add", e, n),
  getObservacoesByFunilId: (e) => i.invoke("observacoes:getByFunilId", e),
  // Dashboard
  getDashboardStats: (e) => i.invoke("dashboard:getStats", e)
});
