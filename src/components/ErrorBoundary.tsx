import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../utils/errorReporting';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(
      'Erro não tratado na interface',
      new Error(`${error.message}\n${info.componentStack}`),
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)] p-6">
          <section className="max-w-lg rounded-lg border border-[var(--border-color)] p-8 text-center">
            <h1 className="mb-3 text-xl font-semibold text-[var(--text-primary)]">
              Ocorreu um erro inesperado
            </h1>
            <p className="mb-6 text-[var(--text-secondary)]">
              O erro foi registrado. Recarregue o aplicativo para tentar
              continuar.
            </p>
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => window.location.reload()}
              type="button"
            >
              Recarregar aplicativo
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
