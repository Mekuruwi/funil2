import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';
import type { AppUpdateStatus } from '../types/electron';

export function UpdateNotification() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.updates.onStatus((nextStatus) => {
      setStatus(nextStatus);
      setDismissed(false);
      if (dismissTimer.current !== null)
        window.clearTimeout(dismissTimer.current);
      if (nextStatus.status === 'not-available') {
        dismissTimer.current = window.setTimeout(
          () => setDismissed(true),
          7000,
        );
      }
    });

    return () => {
      unsubscribe();
      if (dismissTimer.current !== null)
        window.clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!status || dismissed) return null;

  const close = () => setDismissed(true);
  const panelClass =
    'fixed right-4 top-20 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-[var(--text-primary)] shadow-xl';
  const buttonClass =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-color)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60';

  if (status.status === 'checking') {
    return (
      <section className={panelClass} role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <RefreshCw
            size={18}
            className="animate-spin text-[var(--accent-color)]"
          />
          <p className="text-sm">Verificando atualizações...</p>
        </div>
      </section>
    );
  }

  if (status.status === 'available') {
    return (
      <section className={panelClass} role="status" aria-live="polite">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar aviso"
          className="absolute right-3 top-3 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3 pr-5">
          <Download
            size={19}
            className="mt-0.5 shrink-0 text-[var(--accent-color)]"
          />
          <div>
            <h2 className="font-semibold">Nova versão disponível</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              A versão {status.version} pode ser baixada.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={() => {
              void window.electronAPI.updates.download();
            }}
            className={buttonClass}
          >
            <Download size={15} /> Baixar atualização
          </button>
        </div>
      </section>
    );
  }

  if (status.status === 'downloading') {
    return (
      <section className={panelClass} role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <Download size={18} className="shrink-0 text-[var(--accent-color)]" />
          <p className="text-sm">Baixando atualização: {status.percent}%</p>
        </div>
        <progress
          className="mt-3 h-2 w-full accent-[var(--accent-color)]"
          max={100}
          value={status.percent}
          aria-label="Progresso do download"
        />
      </section>
    );
  }

  if (status.status === 'downloaded') {
    return (
      <section className={panelClass} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
          <div>
            <h2 className="font-semibold">Atualização pronta</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Reinicie o aplicativo para instalar a versão {status.version}.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              void window.electronAPI.updates.install();
            }}
            className={buttonClass}
          >
            <RefreshCw size={15} /> Reiniciar e atualizar
          </button>
        </div>
      </section>
    );
  }

  if (status.status === 'not-available') {
    return (
      <section className={panelClass} role="status" aria-live="polite">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar aviso"
          className="absolute right-3 top-3 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 pr-5">
          <CheckCircle2 size={19} className="shrink-0 text-emerald-600" />
          <p className="text-sm">
            O aplicativo está atualizado (versão {status.currentVersion}).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={panelClass} role="alert" aria-live="assertive">
      <button
        type="button"
        onClick={close}
        aria-label="Fechar aviso"
        className="absolute right-3 top-3 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-5">
        <AlertCircle size={19} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <h2 className="font-semibold">Não foi possível atualizar</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Confira sua conexão e tente novamente.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            void window.electronAPI.updates.check();
          }}
          className={buttonClass}
        >
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    </section>
  );
}
