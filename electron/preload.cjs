const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  logError: (context, message, stack) => ipcRenderer.invoke('app:logError', context, message, stack),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    close: () => ipcRenderer.invoke('window:close'),
    editCommand: (command) => ipcRenderer.invoke('window:editCommand', command),
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('updates:status', listener);
      return () => ipcRenderer.removeListener('updates:status', listener);
    },
  },
  getRegionais: () => ipcRenderer.invoke('regionais:getAll'),
  importRegionais: (regionais) => ipcRenderer.invoke('regionais:import', regionais),
  getFunil: () => ipcRenderer.invoke('funil:getAll'),
  getFunilById: (id) => ipcRenderer.invoke('funil:getById', id),
  insertFunil: (funil) => ipcRenderer.invoke('funil:insert', funil),
  updateFunil: (id, funil) => ipcRenderer.invoke('funil:update', id, funil),
  replaceFunilResponsavel: (currentName, nextName) => ipcRenderer.invoke('funil:replaceResponsavel', currentName, nextName),
  bulkUpdateFunil: (request) => ipcRenderer.invoke('funil:bulkUpdate', request),
  updateFunilPhase: (id, fase) => ipcRenderer.invoke('funil:updatePhase', id, fase),
  deleteFunil: (id) => ipcRenderer.invoke('funil:delete', id),
  deleteFunis: (ids) => ipcRenderer.invoke('funil:deleteMany', ids),
  importFunis: (funis) => ipcRenderer.invoke('funil:import', funis),
  importObservacoes: (observacoes) => ipcRenderer.invoke('observacoes:import', observacoes),
  getSystemHealthMetrics: () => ipcRenderer.invoke('systemHealth:getMetrics'),
  database: {
    testConnection: (config) => ipcRenderer.invoke('database:testConnection', config),
    getCurrentProvider: () => ipcRenderer.invoke('database:getCurrentProvider'),
    getCurrentConfig: () => ipcRenderer.invoke('database:getCurrentConfig'),
    switchProvider: (config) => ipcRenderer.invoke('database:switchProvider', config),
    migrateData: (from, to) => ipcRenderer.invoke('database:migrateData', from, to),
  },
  settings: {
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
    getDocumentSettings: () => ipcRenderer.invoke('documents:getSettings'),
    selectDocumentTemplate: (kind) => ipcRenderer.invoke('documents:selectTemplate', kind),
    selectDocumentOutputFolder: () => ipcRenderer.invoke('documents:selectOutputFolder'),
    saveDocumentSettings: (settings) => ipcRenderer.invoke('documents:saveSettings', settings),
    importPriceCatalog: (rows) => ipcRenderer.invoke('documents:importPriceCatalog', rows),
    generateDocuments: (request) => ipcRenderer.invoke('documents:generate', request),
  },
  addObservacao: (funilId, observacao, data) => ipcRenderer.invoke('observacoes:add', funilId, observacao, data),
});
