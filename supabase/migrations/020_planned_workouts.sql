-- Migration 020: treinos programados (calendário estilo TrainingPeaks)
-- Treino planejado pelo treinador; o atleta vê e marca como feito. O "realizado"
-- continua vindo da tabela activities (importações), casado por data.

create table if not exists public.planned_workouts (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid references public.athletes(id) on delete cascade not null,
  date                 date not null,
  sport                text not null default 'running'
                         check (sport in ('running','cycling','triathlon','swimming','duathlon','strength','other')),
  title                text not null,
  description          text,                 -- ex.: "4x1km Z4, rec 2min"
  planned_duration_min integer check (planned_duration_min >= 0),
  planned_tss          integer check (planned_tss >= 0),
  completed            boolean not null default false,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_planned_workouts_athlete_date on public.planned_workouts(athlete_id, date);

alter table public.planned_workouts enable row level security;

-- Treinador gerencia os treinos dos próprios atletas
drop policy if exists "coach_planned" on public.planned_workouts;
create policy "coach_planned" on public.planned_workouts for all
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()))
  with check (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- Admin gerencia todos
drop policy if exists "admin_planned" on public.planned_workouts;
create policy "admin_planned" on public.planned_workouts for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- Atleta lê os próprios treinos programados
drop policy if exists "athlete_planned_select" on public.planned_workouts;
create policy "athlete_planned_select" on public.planned_workouts for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

-- Atleta pode marcar como feito (update) nos próprios treinos
drop policy if exists "athlete_planned_update" on public.planned_workouts;
create policy "athlete_planned_update" on public.planned_workouts for update
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from public.athletes where user_id = auth.uid()));
