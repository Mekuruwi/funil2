// The Electron sandbox loads this file as CommonJS, even though the app uses ES modules.
import { contextBridge, ipcRenderer } from 'electron';
import type {
  FunilImportInput,
  FunilInput,
  ObservationImportInput,
  RegionalImportInput,
} from '../src/types';

contextBridge.exposeInMainWorld('electronAPI', {
  logError: (context: string, message: string, stack?: string) =>
    ipcRenderer.invoke('app:logError', context, message, stack),
  openUninstallSettings: () => ipcRenderer.invoke('app:openUninstallSettings'),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
    close: () => ipcRenderer.invoke('window:close'),
    editCommand: (command: string) => ipcRenderer.invoke('window:editCommand', command),
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
      ipcRenderer.on('updates:status', listener);
      return () => ipcRenderer.removeListener('updates:status', listener);
    },
  },
  // Regionais
  getRegionais: () => ipcRenderer.invoke('regionais:getAll'),
  importRegionais: (regionais: RegionalImportInput[]) => ipcRenderer.invoke('regionais:import', regionais),

  // Funil
  getFunil: () => ipcRenderer.invoke('funil:getAll'),
  getFunilById: (id: number) => ipcRenderer.invoke('funil:getById', id),
  insertFunil: (funil: FunilInput) => ipcRenderer.invoke('funil:insert', funil),
  updateFunil: (id: number, funil: FunilInput) => ipcRenderer.invoke('funil:update', id, funil),
  replaceFunilResponsavel: (currentName: string, nextName: string) => ipcRenderer.invoke('funil:replaceResponsavel', currentName, nextName),
  bulkUpdateFunil: (request: unknown) => ipcRenderer.invoke('funil:bulkUpdate', request),
  updateFunilPhase: (id: number, fase: number) => ipcRenderer.invoke('funil:updatePhase', id, fase),
  deleteFunil: (id: number) => ipcRenderer.invoke('funil:delete', id),
  deleteFunis: (ids: number[]) => ipcRenderer.invoke('funil:deleteMany', ids),
  importFunis: (funis: FunilImportInput[]) => ipcRenderer.invoke('funil:import', funis),
  importObservacoes: (observacoes: ObservationImportInput[]) =>
    ipcRenderer.invoke('observacoes:import', observacoes),
  getSystemHealthMetrics: () => ipcRenderer.invoke('systemHealth:getMetrics'),
  database: {
    testConnection: (config: unknown) => ipcRenderer.invoke('database:testConnection', config),
    getCurrentProvider: () => ipcRenderer.invoke('database:getCurrentProvider'),
    getCurrentConfig: () => ipcRenderer.invoke('database:getCurrentConfig'),
    switchProvider: (config: unknown) => ipcRenderer.invoke('database:switchProvider', config),
    migrateData: (from: unknown, to: unknown) => ipcRenderer.invoke('database:migrateData', from, to),
  },
  settings: {
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
    getDocumentSettings: () => ipcRenderer.invoke('documents:getSettings'),
    selectDocumentTemplate: (kind: string) => ipcRenderer.invoke('documents:selectTemplate', kind),
    selectDocumentOutputFolder: () => ipcRenderer.invoke('documents:selectOutputFolder'),
    saveDocumentSettings: (settings: unknown) => ipcRenderer.invoke('documents:saveSettings', settings),
    importPriceCatalog: (rows: unknown[]) => ipcRenderer.invoke('documents:importPriceCatalog', rows),
    generateDocuments: (request: unknown) => ipcRenderer.invoke('documents:generate', request),
  },

  // Observacoes
  addObservacao: (funilId: number, observacao: string, data?: string) => 
    ipcRenderer.invoke('observacoes:add', funilId, observacao, data),
});

export type ElectronAPI = typeof window.electronAPI;
