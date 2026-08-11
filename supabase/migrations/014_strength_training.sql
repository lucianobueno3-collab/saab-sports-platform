-- Migration 014: treino de força — programas com estrutura de dias/exercícios

create table if not exists public.strength_programs (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid references public.athletes(id) on delete cascade not null,
  name         text not null,
  template_key text,                 -- template de origem (full_body_3x, upper_lower...) ou null p/ personalizado
  goal         text,                 -- forca_max | hipertrofia | potencia | resistencia | prevencao
  phase        text,                 -- base | especifico | competitivo | transicao
  active       boolean default true,
  -- structure: [{ day, label, exercises: [{ name, muscle, sets, reps, load, rest_s, rpe, notes }] }]
  structure    jsonb not null default '[]'::jsonb,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_strength_programs_athlete on public.strength_programs(athlete_id, created_at desc);

alter table public.strength_programs enable row level security;

create policy "coach_strength_programs" on public.strength_programs
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- Registro de 1RM por exercício (histórico de força máxima)
create table if not exists public.strength_prs (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid references public.athletes(id) on delete cascade not null,
  exercise      text not null,
  measured_at   date not null default current_date,
  one_rm_kg     numeric not null,
  estimated     boolean default false,   -- true = calculado por Epley a partir de carga x reps
  notes         text,
  created_at    timestamptz default now()
);

create index if not exists idx_strength_prs_athlete on public.strength_prs(athlete_id, exercise, measured_at desc);

alter table public.strength_prs enable row level security;

create policy "coach_strength_prs" on public.strength_prs
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
