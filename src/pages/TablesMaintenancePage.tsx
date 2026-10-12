import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, FileSpreadsheet, Loader2, Save, Trash2, Upload, UserPlus, XCircle } from 'lucide-react';
import { readExcelFile } from '../services/excelService';
import type { DocumentSettings, FunilBulkCondition, FunilBulkField, FunilBulkOperator, PriceCatalogRow, ResponsibleContact } from '../types/electron';
import type { FunilWithDetails } from '../types';

const fields: Array<{ value: FunilBulkField; label: string }> = [
  { value: 'responsavel', label: 'Responsável' },
  { value: 'regional', label: 'Regional' },
  { value: 'carteira', label: 'Carteira' },
  { value: 'ev', label: 'Executivo' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'lumiax_genomica', label: 'Negócio' },
  { value: 'uf', label: 'UF' },
];

const operators: Array<{ value: FunilBulkOperator; label: string }> = [
  { value: 'equals', label: 'é igual a' },
  { value: 'contains', label: 'contém' },
  { value: 'startsWith', label: 'começa com' },
  { value: 'isEmpty', label: 'está vazio' },
  { value: 'isNotEmpty', label: 'não está vazio' },
];

type Feedback = { success: boolean; message: string } | null;
type Rule = { field: FunilBulkField; operator: FunilBulkOperator; value: string };

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
const valueForField = (record: FunilWithDetails, field: FunilBulkField) => String(record[field] ?? '');

function matches(record: FunilWithDetails, rule: Rule) {
  const value = normalize(valueForField(record, rule.field));
  const expected = normalize(rule.value);
  switch (rule.operator) {
    case 'equals': return value === expected;
    case 'contains': return value.includes(expected);
    case 'startsWith': return value.startsWith(expected);
    case 'isEmpty': return !value;
    case 'isNotEmpty': return Boolean(value);
  }
}

export function TablesMaintenancePage() {
  const [records, setRecords] = useState<FunilWithDetails[]>([]);
  const [settings, setSettings] = useState<DocumentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContacts, setSavingContacts] = useState(false);
  const [importingPrices, setImportingPrices] = useState(false);
  const [applyingRule, setApplyingRule] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [newContactName, setNewContactName] = useState('');
  const [updateField, setUpdateField] = useState<FunilBulkField>('responsavel');
  const [newValue, setNewValue] = useState('');
  const [rules, setRules] = useState<Rule[]>([{ field: 'responsavel', operator: 'equals', value: '' }]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [funis, documentSettings] = await Promise.all([
        window.electronAPI.getFunil(),
        window.electronAPI.settings.getDocumentSettings(),
      ]);
      setRecords(funis);
      setSettings(documentSettings);
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível carregar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const contactRows = useMemo(() => {
    const contacts = new Map<string, ResponsibleContact>();
    records.forEach(record => {
      const name = String(record.responsavel || '').trim();
      if (name && !contacts.has(normalize(name))) contacts.set(normalize(name), { name, email: '', phone: '' });
    });
    (settings?.responsibleContacts || []).forEach(contact => contacts.set(normalize(contact.name), contact));
    return Array.from(contacts.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [records, settings?.responsibleContacts]);

  const registeredNames = useMemo(() => Array.from(new Set(records.map(record => String(record.responsavel || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [records]);
  const matchingRecords = useMemo(() => records.filter(record => rules.every(rule => matches(record, rule))), [records, rules]);

  const updateContact = (name: string, field: 'email' | 'phone', value: string) => {
    setSettings(current => {
      if (!current) return current;
      const index = current.responsibleContacts.findIndex(contact => normalize(contact.name) === normalize(name));
      const contacts = [...current.responsibleContacts];
      if (index >= 0) contacts[index] = { ...contacts[index], [field]: value };
      else contacts.push({ name, email: field === 'email' ? value : '', phone: field === 'phone' ? value : '' });
      return { ...current, responsibleContacts: contacts };
    });
  };

  const addContact = () => {
    const name = newContactName.trim();
    if (!name || !settings) return;
    if (contactRows.some(contact => normalize(contact.name) === normalize(name))) {
      setFeedback({ success: false, message: 'Esse responsável já está na lista.' });
      return;
    }
    setSettings({ ...settings, responsibleContacts: [...settings.responsibleContacts, { name, email: '', phone: '' }] });
    setNewContactName('');
    setFeedback(null);
  };

  const removeContact = (name: string) => {
    setSettings(current => current ? { ...current, responsibleContacts: current.responsibleContacts.filter(contact => normalize(contact.name) !== normalize(name)) } : current);
  };

  const saveContacts = async () => {
    if (!settings) return;
    setSavingContacts(true);
    setFeedback(null);
    try {
      const saved = await window.electronAPI.settings.saveDocumentSettings({ ...settings, responsibleContacts: contactRows });
      setSettings(saved);
      setFeedback({ success: true, message: 'Contatos salvos. Eles serão preenchidos nas propostas pelo nome do responsável.' });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar os contatos.' });
    } finally {
      setSavingContacts(false);
    }
  };

  const importPrices = async (file?: File) => {
    if (!file || !settings) return;
    setImportingPrices(true);
    setFeedback(null);
    try {
      const result = await readExcelFile(file);
      if (!result.success || !result.data) throw new Error(result.error || 'Não foi possível ler a planilha.');
      const find = (row: Record<string, unknown>, aliases: string[]) => {
        const key = Object.keys(row).find(candidate => aliases.includes(candidate.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')));
        return key ? row[key] : undefined;
      };
      const rows: PriceCatalogRow[] = result.data.map(raw => {
        const row = raw as Record<string, unknown>;
        const rawValue = find(row, ['valor base', 'valorbase', 'valor']);
        const numericText = String(rawValue ?? '').trim();
        const normalizedValue = numericText.includes(',') ? numericText.replace(/\./g, '').replace(',', '.') : numericText;
        return {
          exam: String(find(row, ['exames', 'exame']) ?? '').trim(),
          order: Number(find(row, ['ordem'])),
          service: String(find(row, ['servico', 'serviço']) ?? '').trim(),
          baseValue: typeof rawValue === 'number' ? rawValue : Number(normalizedValue),
        };
      });
      const imported = await window.electronAPI.settings.importPriceCatalog(rows);
      const saved = await window.electronAPI.settings.saveDocumentSettings({ ...settings, priceCatalog: rows, priceCatalogName: file.name });
      setSettings(saved);
      setFeedback({ success: true, message: `${imported.count} preços importados de ${file.name}.` });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível importar a tabela de preços.' });
    } finally {
      setImportingPrices(false);
    }
  };

  const updateRule = (index: number, values: Partial<Rule>) => setRules(current => current.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...values } : rule));

  const applyBulkUpdate = async () => {
    if (!newValue.trim() || !matchingRecords.length) return;
    const summary = rules.map(rule => `${fields.find(field => field.value === rule.field)?.label} ${operators.find(operator => operator.value === rule.operator)?.label}${rule.value ? ` "${rule.value}"` : ''}`).join(' E ');
    if (!window.confirm(`Atualizar ${fields.find(field => field.value === updateField)?.label} para "${newValue.trim()}" em ${matchingRecords.length} registro(s) que atendem a esta regra?\n\n${summary}`)) return;
    setApplyingRule(true);
    setFeedback(null);
    try {
      const conditions: FunilBulkCondition[] = rules.map(({ field, operator, value }) => ({ field, operator, value }));
      const count = await window.electronAPI.bulkUpdateFunil({ field: updateField, newValue: newValue.trim(), conditions });
      const updatedRecords = await window.electronAPI.getFunil();
      setRecords(updatedRecords);
      setFeedback({ success: true, message: `${count} registro(s) atualizado(s).` });
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : 'Não foi possível aplicar a atualização.' });
    } finally {
      setApplyingRule(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]';

  return <div className="h-full overflow-y-auto p-6 lg:p-8">
    <header className="mb-6">
      <p className="mb-2 text-sm font-medium text-[var(--accent-color)]">ADMINISTRAÇÃO</p>
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">Tabelas e manutenção</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Cadastros de apoio, tabela de preços e alterações em massa nos registros do funil.</p>
    </header>

    {loading ? <div className="animate-pulse space-y-4"><div className="h-32 rounded-xl bg-[var(--bg-secondary)]" /><div className="h-64 rounded-xl bg-[var(--bg-secondary)]" /></div> : <div className="space-y-5">
      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]"><UserPlus size={19} /> Contatos dos responsáveis</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">A lista acompanha os responsáveis do funil. E-mail e telefone são preenchidos na geração das propostas.</p>
          </div>
          <button type="button" onClick={() => void saveContacts()} disabled={!settings || savingContacts} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {savingContacts ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar contatos
          </button>
        </div>
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); addContact(); }}>
          <input value={newContactName} onChange={event => setNewContactName(event.target.value)} placeholder="Adicionar responsável manualmente" className="min-w-[220px] flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" />
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"><UserPlus size={15} /> Adicionar</button>
        </form>
        <div className="space-y-2">
          {contactRows.length === 0 ? <p className="rounded-lg bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">Nenhum responsável encontrado nos registros.</p> : contactRows.map(contact => {
            const isRegistered = registeredNames.some(name => normalize(name) === normalize(contact.name));
            return <div key={contact.name} className="grid gap-2 rounded-lg bg-[var(--bg-primary)] p-3 md:grid-cols-[minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(150px,0.8fr)_auto] md:items-center">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--text-primary)]">{contact.name}</p><p className="text-xs text-[var(--text-secondary)]">{isRegistered ? 'Responsável do funil' : 'Cadastro manual'}</p></div>
              <input aria-label={`E-mail de ${contact.name}`} type="email" value={contact.email} onChange={event => updateContact(contact.name, 'email', event.target.value)} placeholder="E-mail" className={inputClass} />
              <input aria-label={`Telefone de ${contact.name}`} value={contact.phone} onChange={event => updateContact(contact.name, 'phone', event.target.value)} placeholder="Telefone" className={inputClass} />
              {!isRegistered && <button type="button" aria-label={`Remover ${contact.name}`} onClick={() => removeContact(contact.name)} className="justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-500/10"><Trash2 size={16} /></button>}
            </div>;
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]"><FileSpreadsheet size={19} /> Tabela de preços dos exames</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Colunas aceitas: exames, ORDEM, SERVIÇO e Valor base.</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{settings?.priceCatalogName || 'Nenhuma tabela importada'}{settings?.priceCatalog.length ? ` · ${settings.priceCatalog.length} itens` : ''}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
            {importingPrices ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Importar XLSX
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importingPrices} onChange={event => { void importPrices(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]"><ArrowRightLeft size={19} /> Editor de alterações em massa</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Escolha o campo e o novo valor. As condições determinam quais registros serão alterados; todas devem corresponder.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Campo a alterar</span><select value={updateField} onChange={event => setUpdateField(event.target.value as FunilBulkField)} className={inputClass}>{fields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Novo valor</span><input value={newValue} onChange={event => setNewValue(event.target.value)} placeholder="Valor que será aplicado" className={inputClass} /></label>
        </div>
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Aplicar quando</h3><button type="button" onClick={() => setRules(current => current.length >= 5 ? current : [...current, { field: 'responsavel', operator: 'equals', value: '' }])} disabled={rules.length >= 5} className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-50">Adicionar condição E</button></div>
          {rules.map((rule, index) => <div key={index} className="grid gap-2 rounded-lg border border-[var(--border-color)] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <select aria-label={`Campo da condição ${index + 1}`} value={rule.field} onChange={event => updateRule(index, { field: event.target.value as FunilBulkField })} className={inputClass}>{fields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}</select>
            <select aria-label={`Operador da condição ${index + 1}`} value={rule.operator} onChange={event => updateRule(index, { operator: event.target.value as FunilBulkOperator })} className={inputClass}>{operators.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select>
            {rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty' ? <input aria-label={`Valor da condição ${index + 1}`} value={rule.value} onChange={event => updateRule(index, { value: event.target.value })} placeholder="Valor a localizar" className={inputClass} /> : <div className="flex items-center px-3 text-xs text-[var(--text-secondary)]">Sem valor necessário</div>}
            <button type="button" aria-label={`Remover condição ${index + 1}`} disabled={rules.length === 1} onClick={() => setRules(current => current.filter((_, itemIndex) => itemIndex !== index))} className="justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-500/10 disabled:opacity-30"><Trash2 size={16} /></button>
          </div>)}
        </div>
        <div className="mt-5 rounded-lg bg-[var(--bg-primary)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-[var(--text-primary)]">Prévia: {matchingRecords.length} registro(s)</p><p className="text-xs text-[var(--text-secondary)]">A contagem é calculada com os dados carregados do banco.</p></div><button type="button" onClick={() => void applyBulkUpdate()} disabled={applyingRule || !newValue.trim() || rules.some(rule => !['isEmpty', 'isNotEmpty'].includes(rule.operator) && !rule.value.trim()) || !matchingRecords.length} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{applyingRule ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />} Aplicar alteração</button></div>
          {matchingRecords.length > 0 && <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-[var(--border-color)]"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[var(--bg-secondary)] text-[var(--text-secondary)]"><tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">CNPJ</th><th className="px-3 py-2">Valor atual de {fields.find(field => field.value === updateField)?.label}</th></tr></thead><tbody>{matchingRecords.slice(0, 20).map(record => <tr key={record.id} className="border-t border-[var(--border-color)]"><td className="px-3 py-2 text-[var(--text-primary)]">{record.razao_social || record.nome_fantasia || 'Sem nome'}</td><td className="px-3 py-2 text-[var(--text-secondary)]">{record.cnpj || '—'}</td><td className="px-3 py-2 text-[var(--text-secondary)]">{valueForField(record, updateField) || 'Vazio'} → {newValue || 'Novo valor'}</td></tr>)}</tbody></table>{matchingRecords.length > 20 && <p className="border-t border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-secondary)]">Mostrando 20 de {matchingRecords.length} registros.</p>}</div>}
        </div>
      </section>

      {feedback && <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{feedback.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{feedback.message}</div>}
    </div>}
  </div>;
}
