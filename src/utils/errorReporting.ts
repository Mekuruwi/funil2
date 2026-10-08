export function reportError(context: string, error: unknown): void {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));
  console.error(`[${context}]`, normalizedError);

  if (typeof window === 'undefined' || !window.electronAPI?.logError) return;

  void window.electronAPI
    .logError(context, normalizedError.message, normalizedError.stack)
    .catch((loggingError: unknown) => {
      console.error(
        '[error-reporting] Não foi possível registrar o erro no processo principal.',
        loggingError,
      );
    });
}
