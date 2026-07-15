-- Migration 011: distribuição de tempo em zonas por atividade

-- zone_data: JSON { basis: 'power' | 'hr', seconds: number[], zoneModel: 'coggan' | 'friel' }
-- seconds[i] = segundos gastos na zona i (índice 0 = Z1)
alter table public.activities
  add column if not exists zone_data jsonb;

comment on column public.activities.zone_data is 'Distribuição de tempo em zonas: { basis, seconds[], zoneModel }';
