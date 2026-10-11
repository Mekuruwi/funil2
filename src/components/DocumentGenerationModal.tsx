import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2, Save } from 'lucide-react';
import { Modal } from './Modal';
import type { DocumentGenerationRequest, DocumentSettings } from '../types/electron';
import type { FunilWithDetails } from '../types';

interface Props {
  funil: FunilWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

const documentOptions: Array<{ id: DocumentGenerationRequest['documents'][number]; label: string }> = [
  { id: 'proposal', label: 'Proposta comercial (PPTX)' },
  { id: 'contract', label: 'Contrato' },
  { id: 'addendum', label: 'Termo aditivo' },
];

export const DocumentGenerationModal: React.FC<Props> = ({ funil, isOpen, onClose }) => {
  const [settings, setSettings] = useState<DocumentSettings | null>(null);
  const [documents, setDocuments] = useState<DocumentGenerationRequest['documents']>(['proposal']);
  const [formats, setFormats] = useState<DocumentGenerationRequest['formats']>(['editable', 'pdf']);
  const [templateOverrides, setTemplateOverrides] = useState<DocumentGenerationRequest['templateOverrides']>({});
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [rdi, setRdi] = useState(true);
  const [mtg, setMtg] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !funil) return;
    setDocuments(['proposal']);
    setFormats(['editable', 'pdf']);
    setTemplateOverrides({});
    setMunicipio('');
    setEndereco('');
    setUf(funil.uf || '');
    setEmail('');
    setTelefone('');
    setMessage(null);
    window.electronAPI.settings.getDocumentSettings().then(setSettings).catch(() => setSettings(null));
  }, [isOpen, funil]);

  const lookupAddress = async () => {
    if (!funil?.cnpj) return;
    const cnpj = funil.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      setMessage({ error: true, text: 'O CNPJ precisa ter 14 dígitos para consultar a BrasilAPI.' });
      return;
    }
    setSearchingCnpj(true);
    setMessage(null);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('A BrasilAPI não retornou os dados deste CNPJ.');
      const data = await response.json();
      setMunicipio(String(data.municipio || data.municipio_nome || ''));
      setUf(String(data.uf || funil.uf || ''));
      setEndereco([data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.complemento, data.bairro, data.cep]
        .filter(value => value && String(value).trim())
        .join(', '));
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Falha ao consultar a BrasilAPI.' });
    } finally {
      setSearchingCnpj(false);
    }
  };

  const chooseAlternateTemplate = async (kind: DocumentGenerationRequest['documents'][number]) => {
    const path = await window.electronAPI.settings.selectDocumentTemplate(kind);
    if (path) setTemplateOverrides(current => ({ ...current, [kind]: path }));
  };

  const toggleDocument = (kind: DocumentGenerationRequest['documents'][number]) => {
    setDocuments(current => current.includes(kind) ? current.filter(item => item !== kind) : [...current, kind]);
  };

  const toggleFormat = (format: DocumentGenerationRequest['formats'][number]) => {
    setFormats(current => current.includes(format) ? current.filter(item => item !== format) : [...current, format]);
  };

  const generate = async () => {
    if (!funil || !documents.length || !formats.length) {
      setMessage({ error: true, text: 'Selecione pelo menos um documento e um formato.' });
      return;
    }
    if (documents.includes('proposal') && (!email.trim() || !telefone.trim())) {
      setMessage({ error: true, text: 'Informe o e-mail e o telefone do responsável para gerar a proposta.' });
      return;
    }
    if ((documents.includes('contract') || documents.includes('addendum')) && (!municipio.trim() || !endereco.trim())) {
      setMessage({ error: true, text: 'Consulte ou preencha município e endereço para gerar o documento contratual.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.settings.generateDocuments({
        funil,
        documents,
        formats,
        templateOverrides,
        overrides: { municipio, uf, endereco, email, telefone, rdi, mtg },
      });
      setMessage({ error: false, text: `Arquivos gerados:\n${result.files.join('\n')}` });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Não foi possível gerar os documentos.' });
    } finally {
      setLoading(false);
    }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title="Gerar documentos">
    <div className="space-y-5">
      <div className="rounded-lg bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">{funil?.razao_social || funil?.nome_fantasia || 'Cliente'}</strong>
        {funil?.cnpj ? ` · CNPJ ${funil.cnpj}` : ''}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Documentos</h3>
        <div className="space-y-2">
          {documentOptions.map(option => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={documents.includes(option.id)} onChange={() => toggleDocument(option.id)} />
              {option.label}
              {!settings?.templates[option.id] && !templateOverrides?.[option.id] && <span className="text-xs text-amber-600">(configure o modelo)</span>}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Formatos</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={formats.includes('editable')} onChange={() => toggleFormat('editable')} /> Arquivo editável (PPTX/DOCX)</label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={formats.includes('pdf')} onChange={() => toggleFormat('pdf')} /> PDF</label>
        </div>
      </section>

      {documents.map(kind => documents.includes(kind) && <div key={kind} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] p-3">
        <div className="min-w-0 text-xs text-[var(--text-secondary)]">
          <FileText size={15} className="mr-1 inline" />
          {templateOverrides?.[kind] || settings?.templates[kind] || 'Nenhum modelo padrão escolhido'}
        </div>
        <button type="button" onClick={() => void chooseAlternateTemplate(kind)} className="shrink-0 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-primary)]">Trocar para esta emissão</button>
      </div>)}

      {documents.includes('proposal') && <section className="rounded-lg border border-[var(--border-color)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Escopo da proposta</h3>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-primary)]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={rdi} onChange={event => setRdi(event.target.checked)} /> Incluir RDI</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mtg} onChange={event => setMtg(event.target.checked)} /> Incluir Métodos Gráficos</label>
        </div>
      </section>}

      {documents.length > 0 && <section className="space-y-3 rounded-lg border border-[var(--border-color)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dados para os documentos</h3>
          {(documents.includes('contract') || documents.includes('addendum')) && <button type="button" onClick={() => void lookupAddress()} disabled={searchingCnpj} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-50">
            {searchingCnpj ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Buscar CNPJ na BrasilAPI
          </button>}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(documents.includes('contract') || documents.includes('addendum')) && <>
            <TextField label="Município" value={municipio} onChange={setMunicipio} />
            <TextField label="UF" value={uf} onChange={setUf} />
            <TextField label="Endereço" value={endereco} onChange={setEndereco} wide />
          </>}
          {documents.includes('proposal') && <>
            <TextField label="E-mail do responsável" value={email} onChange={setEmail} />
            <TextField label="Telefone do responsável" value={telefone} onChange={setTelefone} />
          </>}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">Confira os dados consultados antes de emitir. Você pode editá-los nesta geração.</p>
      </section>}

      {documents.includes('proposal') && settings?.priceCatalog.length === 0 && <p className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700"><AlertCircle size={16} className="shrink-0" /> Importe a tabela XLSX de preços nas Configurações antes de gerar a proposta.</p>}
      {documents.includes('proposal') && <p className="text-xs text-[var(--text-secondary)]">Preencha e confira o e-mail e o telefone do responsável para esta proposta.</p>}
      {documents.includes('addendum') && <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700">Use um modelo genérico de termo aditivo. O arquivo recebido anteriormente contém dados preenchidos de outro cliente.</p>}

      {message && <div className={`whitespace-pre-wrap rounded-lg p-3 text-sm ${message.error ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700'}`}>{message.text}</div>}

      <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-primary)]">Fechar</button>
        <button type="button" onClick={() => void generate()} disabled={loading || !documents.length || !formats.length} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {loading ? 'Gerando...' : 'Gerar arquivos'}
        </button>
      </div>
    </div>
  </Modal>;
};

function TextField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={wide ? 'md:col-span-2' : ''}>
    <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" />
  </label>;
}
