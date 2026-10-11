import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { app } from 'electron';

export interface GenerationJob {
  outputFolder: string;
  templates: Record<string, string>;
  documents: string[];
  formats: string[];
  replacements: Record<string, string>;
  priceTokens: Array<{ token: string; service: string }>;
  fileStem: string;
  rdi: boolean;
  mtg: boolean;
}

export async function generateWithOffice(job: GenerationJob): Promise<string[]> {
  if (process.platform !== 'win32') throw new Error('A geração de documentos requer Windows com Microsoft Word e PowerPoint instalados.');
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'funil-docs-'));
  const inputPath = path.join(workDir, 'request.json');
  const resultPath = path.join(workDir, 'result.json');
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'electron', 'generate-documents.ps1')
    : path.join(__dirname, '../electron/generate-documents.ps1');
  try {
    await fs.writeFile(inputPath, JSON.stringify({ ...job, resultPath }), 'utf8');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-InputPath', inputPath], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => child.kill(), 180000);
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('close', async code => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else {
          try {
            const result = JSON.parse((await fs.readFile(resultPath, 'utf8')).replace(/^\uFEFF/, '')) as { error?: string };
            reject(new Error(result.error || stderr || stdout || `Automação do Office terminou com código ${code}.`));
          } catch (error) {
            reject(error instanceof Error && error.message !== 'Unexpected end of JSON input'
              ? error
              : new Error((stderr || stdout || `Automação do Office terminou com código ${code}.`).trim().slice(-4000)));
          }
        }
      });
    });
    const result = JSON.parse((await fs.readFile(resultPath, 'utf8')).replace(/^\uFEFF/, '')) as { files?: unknown; error?: string };
    if (result.error) throw new Error(result.error);
    if (!Array.isArray(result.files) || result.files.some(file => typeof file !== 'string')) throw new Error('O Office não retornou a lista de arquivos gerados.');
    return result.files as string[];
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
