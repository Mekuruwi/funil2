import { app, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { DocumentSettings } from '../../src/types/electron';
import { loadAppConfig, saveAppConfigValue } from '../database/configStore';
import { generateWithOffice } from '../documentGeneration';
import type { IpcRegistrar } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerDocumentIpcHandlers(handleIpc: IpcRegistrar) {
  handleIpc('settings:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  const templateRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'electron', 'templates')
    : path.join(__dirname, '../../electron/templates');
  const defaultDocumentSettings: DocumentSettings = {
    templates: {
      proposal: path.join(templateRoot, '_proposta_padrão.pptx'),
      contract: path.join(templateRoot, 'Modelo Contrato.docx'),
      addendum: null,
    },
    outputFolder: path.join(app.getPath('documents'), 'Funil Comercial'),
    priceCatalog: [],
    priceCatalogName: null,
    responsibleContacts: [],
  };
  const getDocumentSettings = async (): Promise<DocumentSettings> => {
    const config = await loadAppConfig();
    const saved = config.documentSettings as
      Partial<typeof defaultDocumentSettings> | undefined;
    return {
      ...defaultDocumentSettings,
      ...saved,
      templates: {
        ...defaultDocumentSettings.templates,
        ...(saved?.templates || {}),
      },
      priceCatalog: Array.isArray(saved?.priceCatalog)
        ? saved.priceCatalog
        : [],
      responsibleContacts: Array.isArray(saved?.responsibleContacts)
        ? saved.responsibleContacts.filter(
            (
              contact,
            ): contact is { name: string; email: string; phone: string } =>
              Boolean(
                contact &&
                typeof contact === 'object' &&
                typeof (contact as { name?: unknown }).name === 'string' &&
                typeof (contact as { email?: unknown }).email === 'string' &&
                typeof (contact as { phone?: unknown }).phone === 'string',
              ),
          )
        : [],
    };
  };

  handleIpc('documents:getSettings', getDocumentSettings);
  handleIpc('documents:selectTemplate', async (_, kind: string) => {
    const filters =
      kind === 'proposal'
        ? [{ name: 'PowerPoint', extensions: ['pptx'] }]
        : kind === 'contract'
          ? [{ name: 'Word', extensions: ['docx'] }]
          : [{ name: 'Word', extensions: ['docx', 'doc'] }];
    if (!['proposal', 'contract', 'addendum'].includes(kind))
      throw new Error('Tipo de modelo inválido.');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters,
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  handleIpc('documents:selectOutputFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  handleIpc('documents:saveSettings', async (_, input) => {
    if (!input || typeof input !== 'object')
      throw new Error('Configuração de documentos inválida.');
    const current = await getDocumentSettings();
    const templates = (input as typeof current).templates;
    const outputFolder = (input as typeof current).outputFolder;
    const responsibleContacts = (input as Partial<typeof current>)
      .responsibleContacts;
    if (
      !templates ||
      !['proposal', 'contract', 'addendum'].every(
        (key) =>
          templates[key as keyof typeof templates] === null ||
          typeof templates[key as keyof typeof templates] === 'string',
      )
    ) {
      throw new Error('Modelos inválidos.');
    }
    if (typeof outputFolder !== 'string' || !path.isAbsolute(outputFolder))
      throw new Error('Selecione uma pasta de destino válida.');
    if (!Array.isArray(responsibleContacts) || responsibleContacts.length > 500)
      throw new Error('A lista de contatos dos responsáveis é inválida.');
    const normalizedContacts = responsibleContacts.map((contact, index) => {
      if (
        !contact ||
        typeof contact.name !== 'string' ||
        typeof contact.email !== 'string' ||
        typeof contact.phone !== 'string'
      ) {
        throw new Error(`Contato ${index + 1} inválido.`);
      }
      const name = contact.name.trim().slice(0, 160);
      const email = contact.email.trim().slice(0, 254);
      const phone = contact.phone.trim().slice(0, 40);
      if (!name)
        throw new Error(
          `Informe o nome do responsável no contato ${index + 1}.`,
        );
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error(`E-mail inválido para ${name}.`);
      return { name, email, phone };
    });
    const responsibleKeys = normalizedContacts.map((contact) =>
      contact.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR'),
    );
    if (new Set(responsibleKeys).size !== responsibleKeys.length)
      throw new Error('Não pode haver responsáveis repetidos.');
    const next = {
      ...current,
      templates: Object.fromEntries(
        Object.entries(templates).map(([key, value]) => [
          key,
          value ? path.resolve(value) : null,
        ]),
      ) as typeof current.templates,
      outputFolder: path.resolve(outputFolder),
      responsibleContacts: normalizedContacts,
    };
    await fs.mkdir(next.outputFolder, { recursive: true });
    await saveAppConfigValue('documentSettings', next);
    return next;
  });
  handleIpc('documents:importPriceCatalog', async (_, rows: unknown[]) => {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000)
      throw new Error('A tabela deve ter entre 1 e 5.000 itens.');
    const catalog = rows.map((row, index) => {
      if (!row || typeof row !== 'object')
        throw new Error(`Linha ${index + 2}: registro inválido.`);
      const item = row as Record<string, unknown>;
      const exam = String(item.exam || '').trim();
      const service = String(item.service || '').trim();
      const order = Number(item.order);
      const baseValue = Number(item.baseValue);
      if (
        !exam ||
        !service ||
        !Number.isInteger(order) ||
        order < 1 ||
        !Number.isFinite(baseValue) ||
        baseValue < 0
      ) {
        throw new Error(
          `Linha ${index + 2}: preencha exame, ordem, serviço e valor base válido.`,
        );
      }
      return { exam, order, service, baseValue };
    });
    const examKeys = new Set<string>();
    for (const row of catalog) {
      const key = row.exam
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
      if (examKeys.has(key))
        throw new Error(`Exame repetido na tabela: ${row.exam}.`);
      examKeys.add(key);
    }
    const current = await getDocumentSettings();
    const next = {
      ...current,
      priceCatalog: catalog,
      priceCatalogName: 'Tabela de preços importada',
    };
    await saveAppConfigValue('documentSettings', next);
    return { count: catalog.length };
  });
  handleIpc('documents:generate', async (_, request) => {
    const req = request as {
      funil?: Record<string, unknown>;
      documents?: string[];
      formats?: string[];
      overrides?: Record<string, unknown>;
      priceOverrides?: Record<string, unknown>;
      templateOverrides?: Record<string, unknown>;
    };
    const allowedDocuments = ['proposal', 'contract', 'addendum'];
    const allowedFormats = ['editable', 'pdf'];
    if (
      !req?.funil ||
      !Array.isArray(req.documents) ||
      !req.documents.length ||
      req.documents.some((item) => !allowedDocuments.includes(item))
    ) {
      throw new Error('Selecione ao menos um tipo de documento válido.');
    }
    if (
      !Array.isArray(req.formats) ||
      !req.formats.length ||
      req.formats.some((item) => !allowedFormats.includes(item))
    ) {
      throw new Error('Selecione pelo menos um formato.');
    }
    const settings = await getDocumentSettings();
    const templates = {
      ...settings.templates,
      ...(req.templateOverrides || {}),
    };
    for (const documentKind of req.documents as Array<
      'proposal' | 'contract' | 'addendum'
    >) {
      const templatePath = templates[documentKind];
      if (typeof templatePath !== 'string' || !path.isAbsolute(templatePath)) {
        throw new Error(`Configure um modelo válido para ${documentKind}.`);
      }
      const extension = path.extname(templatePath).toLowerCase();
      const validExtension =
        documentKind === 'proposal'
          ? extension === '.pptx'
          : documentKind === 'contract'
            ? extension === '.docx'
            : ['.docx', '.doc'].includes(extension);
      if (!validExtension)
        throw new Error(`O formato do modelo de ${documentKind} é inválido.`);
      const stat = await fs.stat(templatePath).catch(() => null);
      if (!stat?.isFile())
        throw new Error(
          `O modelo configurado não foi encontrado: ${templatePath}`,
        );
    }
    const overrides = req.overrides || {};
    const funil = req.funil;
    const normalizeResponsibleName = (value: unknown) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('pt-BR');
    const responsibleContact = settings.responsibleContacts.find(
      (contact) =>
        normalizeResponsibleName(contact.name) ===
        normalizeResponsibleName(funil.responsavel),
    );
    const replacements: Record<string, string> = {
      '#MES#': `${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())} ${new Date().getFullYear()}`,
      '#ID#':
        funil.id_cliente || funil.id
          ? `ID: ${funil.id_cliente || funil.id}`
          : '',
      '#RAZÃO SOCIAL#': String(funil.razao_social || ''),
      '#CNPJ#': String(funil.cnpj || ''),
      '#UF#': String(overrides.uf || funil.uf || ''),
      '#MUNICIPIO#': String(overrides.municipio || ''),
      '#ENDEREÇO#': String(overrides.endereco || ''),
      '#DATA#': new Intl.DateTimeFormat('pt-BR').format(new Date()),
      '#RESPONSAVEL#': String(funil.responsavel || ''),
      '#EMAIL#': String(overrides.email || responsibleContact?.email || ''),
      '#TELEFONE#': String(
        overrides.telefone || responsibleContact?.phone || '',
      ),
    };
    if (
      req.documents.includes('proposal') &&
      (!replacements['#EMAIL#'] || !replacements['#TELEFONE#'])
    ) {
      throw new Error(
        'Informe o e-mail e o telefone do responsável para gerar a proposta.',
      );
    }
    if (
      req.documents.includes('contract') &&
      (!replacements['#MUNICIPIO#'] || !replacements['#ENDEREÇO#'])
    ) {
      throw new Error(
        'Consulte ou preencha município e endereço para gerar o contrato.',
      );
    }
    const catalogExams = new Set(settings.priceCatalog.map((row) => row.exam));
    for (const [exam, value] of Object.entries(req.priceOverrides || {})) {
      if (!catalogExams.has(exam)) throw new Error(`O exame ${exam} não existe na tabela de preços atual.`);
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Informe um valor válido para o exame ${exam}.`);
      }
    }
    for (const row of settings.priceCatalog) {
      const serviceKey = row.service
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleUpperCase('pt-BR');
      if (overrides.rdi === false && serviceKey.includes('RDI')) continue;
      if (
        overrides.mtg === false &&
        (serviceKey.includes('MTG') || serviceKey.includes('METODOS GRAFICOS'))
      )
        continue;
      const value = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(req.priceOverrides?.[row.exam] as number | undefined ?? row.baseValue);
      replacements[`#${row.exam}#`] = value;
    }
    const safeName = (value: string) =>
      value
        .split('')
        .filter(
          (character) =>
            character.charCodeAt(0) >= 32 && !/[<>:"/\\|?*]/.test(character),
        )
        .join('')
        .replace(/[. ]+$/g, '')
        .trim()
        .slice(0, 120);
    const fileStem =
      safeName(
        `Proposta Lumiax - ${String(funil.razao_social || 'Cliente')}${funil.id_cliente ? ` - ID.${funil.id_cliente}` : ''}`,
      ) || 'Documento Funil';
    const outputFolder =
      settings.outputFolder ||
      path.join(app.getPath('documents'), 'Funil Comercial');
    await fs.mkdir(outputFolder, { recursive: true });
    const files = await generateWithOffice({
      outputFolder,
      templates: Object.fromEntries(
        Object.entries(templates).map(([key, value]) => [
          key,
          String(value || ''),
        ]),
      ),
      documents: req.documents,
      formats: req.formats,
      replacements,
      priceTokens: settings.priceCatalog.map((row) => ({
        token: `#${row.exam}#`,
        service: row.service,
      })),
      fileStem,
      rdi: overrides.rdi !== false,
      mtg: overrides.mtg !== false,
    });
    return { files };
  });
}
