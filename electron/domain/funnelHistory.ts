export interface ObservationRecord {
  id: number;
  funil_id: number;
  data: string;
  observacao: string;
  [key: string]: unknown;
}

export interface FunilWithHistory {
  id: number;
  historico?: unknown;
  [key: string]: unknown;
}

export function parseLegacyHistory(
  funilId: number,
  historico: unknown,
): ObservationRecord[] {
  return String(historico || '')
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
      if (!match) return [];
      return [
        {
          id: -(funilId * 10000 + index + 1),
          funil_id: funilId,
          data: `${match[3]}-${match[2]}-${match[1]}`,
          observacao: match[4].trim(),
        },
      ];
    });
}

export function attachObservations<T extends FunilWithHistory>(
  funis: T[],
  observations: ObservationRecord[],
): Array<T & { observacoes: ObservationRecord[] }> {
  const observationsByFunil = new Map<number, ObservationRecord[]>();
  for (const observation of observations) {
    const current = observationsByFunil.get(observation.funil_id) || [];
    current.push(observation);
    observationsByFunil.set(observation.funil_id, current);
  }

  return funis.map((funil) => {
    const persisted = observationsByFunil.get(funil.id) || [];
    const legacy = parseLegacyHistory(funil.id, funil.historico).sort((a, b) =>
      b.data.localeCompare(a.data),
    );
    return { ...funil, observacoes: persisted.length > 0 ? persisted : legacy };
  });
}

export function normalizedCnpjSql(column: string): string {
  return `replace(replace(replace(replace(${column}, '.', ''), '/', ''), '-', ''), ' ', '')`;
}
