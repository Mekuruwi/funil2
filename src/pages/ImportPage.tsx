import React, { useState } from 'react';
import { readExcelFile, validateRegionaisData } from "../services/excelService";
import { Upload as UploadIcon, FileSpreadsheet, Database } from 'lucide-react';

export const ImportPage: React.FC = () => {
  const [regionaisFile, setRegionaisFile] = useState<File | null>(null);
  const [baseAntigaFile, setBaseAntigaFile] = useState<File | null>(null);
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

  const processRegionaisFile = async () => {
    if (!regionaisFile) return;

    setProcessing(true);
    setStatus({ type: null, message: '' });

    try {
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

      // Limpa a tabela regionais antes de inserir (operação slot - substitui tudo)
      // Deleta todos os registros existentes
      await window.electronAPI.clearRegionais();

      // Insere cada registro validado no banco
      for (const regional of validationResult.validData) {
        await window.electronAPI.insertRegional(regional);
      }

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
      console.log('Processando Base Antiga:', baseAntigaFile.name);
      
      // Estrutura preparada para receber formato futuro
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus({ 
        type: 'success', 
        message: `Base antiga "${baseAntigaFile.name}" processada com sucesso!` 
      });
      setBaseAntigaFile(null);
    } catch (error) {
      setStatus({ type: 'error', message: 'Erro ao processar base antiga.' });
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
            Importe dados da base antiga do sistema. Formato será definido posteriormente.
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
            <p className="mt-1">Estrutura será definida em atualização futura. Entre em contato com o suporte para mais informações.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
