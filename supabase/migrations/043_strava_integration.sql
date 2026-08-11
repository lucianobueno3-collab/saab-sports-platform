-- ─────────────────────────────────────────────────────────────────────────
-- Integração com o Strava
--
-- O aluno conecta a conta e as atividades entram sozinhas no app, casando
-- com o treino planejado do dia.
--
-- SEGURANÇA: os tokens ficam em `strava_connections`, que tem RLS ligado e
-- NENHUMA policy — ou seja, nenhum cliente lê ou escreve. Só a service role
-- (Netlify Functions) acessa. O status da conexão, que a interface precisa
-- mostrar, fica em colunas próprias de `athletes`.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.strava_connections (
  athlete_id        uuid primary key references public.athletes(id) on delete cascade,
  strava_athlete_id bigint,
  access_token      text not null,
  refresh_token     text not null,
  expires_at        bigint not null,       -- epoch em segundos (padrão do Strava)
  scope             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- RLS sem policy = ninguém pelo cliente. Apenas a service role passa.
alter table public.strava_connections enable row level security;

-- Status visível na interface (sem expor token algum)
alter table public.athletes
  add column if not exists strava_athlete_id   bigint,
  add column if not exists strava_connected_at timestamptz,
  add column if not exists strava_last_sync_at timestamptz;

-- Evita duplicar a mesma atividade a cada sincronização
alter table public.activities
  add column if not exists strava_activity_id bigint;

create unique index if not exists uq_activities_strava
  on public.activities (athlete_id, strava_activity_id)
  where strava_activity_id is not null;
