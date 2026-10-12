export interface DashboardFilters {
  negocio?: string;
  regional?: string;
  fase?: string;
  responsavel?: string;
  executivo?: string;
  carteira?: string;
}

export type DashboardRecord = Record<string, unknown>;

export function calculateDashboardStats(
  funis: DashboardRecord[],
  regionais: DashboardRecord[],
  filters: DashboardFilters = {},
  now = new Date(),
) {
  const regionalByCnpj = new Map<string, DashboardRecord>();
  for (const regional of regionais) {
    const cnpj = String(regional.cnpj || '').replace(/\D/g, '');
    if (cnpj && !regionalByCnpj.has(cnpj)) regionalByCnpj.set(cnpj, regional);
  }

  const filteredFunis = funis.filter((funil) => {
    const regional = regionalByCnpj.get(
      String(funil.cnpj || '').replace(/\D/g, ''),
    );
    const regionalName = String(
      regional?.desc_regional_matriz || funil.regional || '',
    );
    return (
      (!filters.negocio ||
        String(funil.lumiax_genomica || '')
          .toLowerCase()
          .includes(String(filters.negocio).toLowerCase())) &&
      (!filters.regional ||
        regionalName
          .toLowerCase()
          .includes(String(filters.regional).toLowerCase())) &&
      (!filters.fase || String(funil.fase) === String(filters.fase)) &&
      (!filters.responsavel ||
        String(funil.responsavel || '')
          .toLowerCase()
          .includes(String(filters.responsavel).toLowerCase())) &&
      (!filters.executivo ||
        String(funil.ev || '')
          .toLowerCase()
          .includes(String(filters.executivo).toLowerCase())) &&
      (!filters.carteira ||
        String(funil.carteira || '')
          .toLowerCase()
          .includes(String(filters.carteira).toLowerCase()))
    );
  });

  const byResponsavel = new Map<
    string,
    { responsavel: string; total: number; count: number }
  >();
  const byFase = new Map<
    string,
    { fase: string; total: number; count: number }
  >();
  for (const funil of filteredFunis) {
    const potential = Number(funil.potencial) || 0;
    const responsavel = String(funil.responsavel || '');
    const fase = String(funil.fase || '');
    const ownerGroup = byResponsavel.get(responsavel) || {
      responsavel,
      total: 0,
      count: 0,
    };
    ownerGroup.total += potential;
    ownerGroup.count += 1;
    byResponsavel.set(responsavel, ownerGroup);
    const phaseGroup = byFase.get(fase) || { fase, total: 0, count: 0 };
    phaseGroup.total += potential;
    phaseGroup.count += 1;
    byFase.set(fase, phaseGroup);
  }

  const currentMonth = now.toISOString().slice(0, 7);
  return {
    totalPotencial: filteredFunis.reduce(
      (total, funil) => total + (Number(funil.potencial) || 0),
      0,
    ),
    totalCount: filteredFunis.length,
    newItemsThisMonth: filteredFunis.filter(
      (funil) => String(funil.data_criacao || '').slice(0, 7) === currentMonth,
    ).length,
    potencialPorResponsavel: [...byResponsavel.values()].sort(
      (a, b) => b.total - a.total,
    ),
    potencialPorFase: [...byFase.values()].sort((a, b) =>
      a.fase.localeCompare(b.fase, undefined, { numeric: true }),
    ),
  };
}
