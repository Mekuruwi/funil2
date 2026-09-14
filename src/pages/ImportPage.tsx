import React, { useState } from 'react';
import { normalizeBaseAntigaData, readExcelFile, validateRegionaisData, downloadObservacoesTemplate } from "../services/excelService";
import { Upload as UploadIcon, FileSpreadsheet, Database, MessageSquare } from 'lucide-react';

export const ImportPage: React.FC = () => {
  const [regionaisFile, setRegionaisFile] = useState<File | null>(null);
  const [baseAntigaFile, setBaseAntigaFile] = useState<File | null>(null);
  const [observacoesFile, setObservacoesFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleFileDrop = (e: React.DragEvent, setter: React.Dispatch<React.SetStateAction<File | null>>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setter(file);
    } else {
      setStatus({ type: 'error', message: 'Formato inválido. Use Excel (.xlsx, .xls) ou CSV.' });
    }
  };

  const processObservacoesFile = async () => {
    if (!observacoesFile) return;
    setProcessing(true);
    setStatus({ type: null, message: '' });
    try {
      const result = await readExcelFile(observacoesFile);
      if (!result.success || !result.data) throw new Error(result.error || 'Erro ao ler o relatório de observações');
      const normalized = result.data.flatMap(row => {
        const cnpj = row.CNPJ || row.cnpj || '';
        const rawDate = String(row.Data || row.data || '').trim();
        const dateMatch = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        const data = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : rawDate;
        const text = row.Observacao || row.Observação || row.Observacoes || '';
        return [{ cnpj, data, observacao: text }];
      });
      const response = await window.electronAPI.importObservacoes(normalized);
      setStatus({ type: 'success', message: `${response.updated} observação(ões) adicionada(s). ${response.ignored} linha(s) ignorada(s).` });
      setObservacoesFile(null);
    } catch (error) {
      setStatus({ type: 'error', message: `Erro ao processar observações: ${(error as Error).message}` });
    } finally {
      setProcessing(false);
    }
  };

  const processRegionaisFile = async () => {
    if (!regionaisFile) return;

    setProcessing(true);
    setStatus({ type: null, message: '' });

    try {
      const electronAPI = window.electronAPI;
      if (
        !electronAPI ||
        typeof electronAPI.importRegionais !== 'function'
      ) {
        throw new Error(
          'A API do Electron não está disponível. Abra o sistema pelo aplicativo Electron para importar arquivos.'
        );
      }

      // Lê o arquivo Excel/CSV
      const result = await readExcelFile(regionaisFile);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Erro ao ler arquivo');
      }

      // Valida e normaliza os dados conforme formato esperado
      const validationResult = validateRegionaisData(result.data);

      // Exibe informações de debug no console
      console.log('=== Debug da Importação ===');
      console.log('Colunas encontradas:', Object.keys(result.data[0]));
      console.log('Total de linhas lidas:', result.data.length);
      console.log('Total de linhas válidas:', validationResult.validData.length);
      console.log('Total de erros:', validationResult.errors.length);

      // Exibe erros de validação detalhados no console
      if (validationResult.errors.length > 0) {
        console.warn('Erros de validação encontrados:', validationResult.errors);
      }

      if (validationResult.validData.length === 0) {
        const errorDetails = 
          `Erros encontrados (${validationResult.errors.length}):\n` +
          validationResult.errors.slice(0, 10).join('\n') +
          (validationResult.errors.length > 10 ? `\n...e mais ${validationResult.errors.length - 10} erros` : '');
        
        throw new Error(
          `Nenhum dado válido encontrado no arquivo.\n\n${errorDetails}`
        );
      }

      // Substitui os registros em uma única transação no processo principal.
      await electronAPI.importRegionais(validationResult.validData);

      const warningMessage = validationResult.errors.length > 0 
        ? `\n\nAvisos: ${validationResult.errors.length} linhas tiveram problemas (veja o console para detalhes)`
        : '';

      setStatus({
        type: 'success',
        message: `${validationResult.validData.length} registros de regionais importados com sucesso!${warningMessage}`
      });
      setRegionaisFile(null);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      let errorMessage = 'Erro ao processar arquivo: ' + (error as Error).message;
      
      // Adiciona dicas de debug
      if ((error as Error).message.includes('Nenhum dado válido')) {
        errorMessage += '\n\nDicas:\n' +
          '- Verifique se o arquivo tem colunas com nomes corretos\n' +
          '- Certifique-se de que há pelo menos uma linha de dados\n' +
          '- Confira se as colunas "id", "cnpj" ou "nome_cliente" estão presentes';
      }
      
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setProcessing(false);
    }
  };

  const processBaseAntigaFile = async () => {
    if (!baseAntigaFile) return;
    
    setProcessing(true);
    setStatus({ type: null, message: '' });
    
    try {
      const electronAPI = window.electronAPI;
      if (!electronAPI || typeof electronAPI.importFunis !== 'function') {
        throw new Error('A API do Electron não está disponível. Abra o sistema pelo aplicativo Electron.');
      }

      const result = await readExcelFile(baseAntigaFile);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Erro ao ler a base antiga');
      }

      const validationResult = normalizeBaseAntigaData(result.data);
      if (validationResult.validData.length === 0) {
        throw new Error('Nenhum registro válido encontrado na base antiga.');
      }

      await electronAPI.importFunis(validationResult.validData);
      setStatus({ 
        type: 'success', 
        message: `${validationResult.validData.length} registros da base antiga foram adicionados com sucesso!${
          validationResult.errors.length > 0 ? ` ${validationResult.errors.length} linhas foram ignoradas.` : ''
        }`
      });
      setBaseAntigaFile(null);
    } catch (error) {
      console.error('Erro ao processar base antiga:', error);
      setStatus({ type: 'error', message: `Erro ao processar base antiga: ${(error as Error).message}` });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Importação de Dados</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arquivo Regionais */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileSpreadsheet className="text-green-600" size={28} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Arquivo Regionais</h2>
          </div>

          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Importe a base de clientes (regionais). Campos esperados: ID, Carteira, Nome Fantasia, Razão Social, CNPJ, Executivo, Regional, Coordenador, Gerente.
          </p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, setRegionaisFile)}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${regionaisFile 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'
              }
            `}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setRegionaisFile(e.target.files?.[0] || null)}
              className="hidden"
              id="regionais-file"
            />
            <label htmlFor="regionais-file" className="cursor-pointer">
              <UploadIcon 
                size={48} 
                className={`mx-auto mb-4 ${regionaisFile ? 'text-green-600' : 'text-[var(--text-secondary)]'}`} 
              />
              {regionaisFile ? (
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{regionaisFile.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {(regionaisFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[var(--text-primary)]">Arraste e solte o arquivo aqui</p>
                  <p className="text-sm text-[var(--text-secondary)]">ou clique para selecionar</p>
                </div>
              )}
            </label>
          </div>

          <button
            onClick={processRegionaisFile}
            disabled={!regionaisFile || processing}
            className={`
              w-full mt-4 py-3 rounded-lg font-medium transition-colors
              ${!regionaisFile || processing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[var(--accent-color)] text-white hover:opacity-90'
              }
            `}
          >
            {processing ? 'Processando...' : 'Processar Arquivo'}
          </button>
        </div>

        {/* Base Antiga */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="text-blue-600" size={28} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Base Antiga</h2>
          </div>
          
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Importe os registros existentes do arquivo Funil.xlsx. Os dados serão adicionados ao funil atual.
          </p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, setBaseAntigaFile)}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${baseAntigaFile 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'
              }
            `}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setBaseAntigaFile(e.target.files?.[0] || null)}
              className="hidden"
              id="base-antiga-file"
            />
            <label htmlFor="base-antiga-file" className="cursor-pointer">
              <UploadIcon 
                size={48} 
                className={`mx-auto mb-4 ${baseAntigaFile ? 'text-blue-600' : 'text-[var(--text-secondary)]'}`} 
              />
              {baseAntigaFile ? (
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{baseAntigaFile.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {(baseAntigaFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[var(--text-primary)]">Arraste e solte o arquivo aqui</p>
                  <p className="text-sm text-[var(--text-secondary)]">ou clique para selecionar</p>
                </div>
              )}
            </label>
          </div>

          <button
            onClick={processBaseAntigaFile}
            disabled={!baseAntigaFile || processing}
            className={`
              w-full mt-4 py-3 rounded-lg font-medium transition-colors
              ${!baseAntigaFile || processing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[var(--accent-color)] text-white hover:opacity-90'
              }
            `}
          >
            {processing ? 'Processando...' : 'Processar Base'}
          </button>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[var(--accent-color)]/10">
            <UploadIcon size={22} className="text-[var(--accent-color)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Atualizações</h2>
            <p className="text-sm text-[var(--text-secondary)]">Adicione informações aos registros existentes sem substituir a base atual.</p>
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-[var(--accent-color)]" size={26} />
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Observações</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Envie novas observações vinculadas aos cards pelo CNPJ.</p>
              </div>
            </div>
            <button type="button" onClick={downloadObservacoesTemplate} className="shrink-0 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
              Baixar modelo
            </button>
          </div>
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] mb-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Colunas esperadas: <strong className="text-[var(--text-primary)]">CNPJ</strong>, <strong className="text-[var(--text-primary)]">Data</strong> e <strong className="text-[var(--text-primary)]">Observacao</strong>.
            </p>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setObservacoesFile(e.target.files?.[0] || null)} className="block w-full text-sm text-[var(--text-secondary)]" />
          <button onClick={processObservacoesFile} disabled={!observacoesFile || processing} className="w-full mt-4 py-3 rounded-lg bg-[var(--accent-color)] text-white disabled:opacity-50">
            {processing ? 'Processando...' : 'Adicionar observações'}
          </button>
        </div>
      </section>

      {/* Status Message */}
      {status.message && (
        <div className={`
          mt-6 p-4 rounded-lg flex items-center gap-3
          ${status.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30' : ''}
          ${status.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30' : ''}
        `}>
          {status.type === 'success' && (
            <span className="text-xl">✓</span>
          )}
          {status.type === 'error' && (
            <span className="text-xl">✕</span>
          )}
          <p>{status.message}</p>
        </div>
      )}

      {/* Instruções */}
      <div className="mt-8 bg-[var(--bg-secondary)] rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Instruções de Importação</h3>
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div>
            <strong className="text-[var(--text-primary)]">Arquivo Regionais:</strong>
            <p className="mt-1">O arquivo Excel/CSV deve conter as colunas: id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, EMAIL, NOME_COORDENADOR. Ao importar, todos os registros anteriores serão substituídos (operação slot).</p>
          </div>
          <div>
            <strong className="text-[var(--text-primary)]">Base Antiga:</strong>
            <p className="mt-1">A planilha deve conter as colunas da base antiga (Lumiax/Genomica, Responsavel, Cnpj, Fase, Potencial e etapas do funil). Os registros são adicionados sem apagar os atuais.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
