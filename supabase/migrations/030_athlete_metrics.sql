-- ─────────────────────────────────────────────────────────────────────────
-- Métricas do atleta (dados de exames/laudos importados, por categoria)
--
-- Armazém genérico para "todo dado do exame vira métrica": composição
-- corporal, circunferências, dobras cutâneas, etc. Cada valor é uma linha
-- com categoria + chave + rótulo + valor + unidade + data, permitindo
-- histórico e evolução por métrica. Alimentado pelos parsers homologados
-- de cada layout de importação.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.athlete_metrics (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  measured_at  date not null,
  category     text not null,          -- composicao | circunferencia | dobra | sangue | outro
  metric_key   text not null,          -- ex.: peso, cintura, dobra_triceps
  label        text not null,          -- ex.: Peso, Cintura, Dobra Tríceps
  value        numeric not null,
  unit         text,                   -- kg | cm | mm | % | ''
  source       text,                   -- layout/arquivo de origem
  created_at   timestamptz not null default now(),
  unique (athlete_id, metric_key, measured_at)
);

create index if not exists idx_athlete_metrics_lookup
  on public.athlete_metrics (athlete_id, category, metric_key, measured_at desc);

alter table public.athlete_metrics enable row level security;

-- Staff (treinador/admin) gerencia tudo.
drop policy if exists athlete_metrics_staff_all on public.athlete_metrics;
create policy athlete_metrics_staff_all on public.athlete_metrics
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- O próprio atleta gerencia as suas métricas (importa pelo portal).
drop policy if exists athlete_metrics_owner on public.athlete_metrics;
create policy athlete_metrics_owner on public.athlete_metrics
  for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());
