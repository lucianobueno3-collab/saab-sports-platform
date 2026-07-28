-- ─────────────────────────────────────────────────────────────────────────
-- Programas de treino (composições semi-programadas)
--
-- Um "programa" é uma composição de semanas × treinos (grupos de treinos),
-- reutilizável e editável no compositor visual. Cada programa pode ter
-- critérios de roteamento (nível, objetivo, corre/não corre, dias/semana)
-- para a anamnese direcionar o aluno ao programa ideal.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.training_programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  sport        text not null default 'running',
  goal         text,
  level        text,                       -- iniciante | intermediario | avancado
  weeks        jsonb not null default '[]'::jsonb,  -- [{ label, workouts:[{day,sport,title,description,duration_min,tss,structure?}] }]
  routing      jsonb,                       -- { currently_running, levels:[], goals:[], min_days, max_days }
  package_key  text,                        -- ex.: primeiros_5k
  active       boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_training_programs_active on public.training_programs (active, created_at desc);

alter table public.training_programs enable row level security;

-- Staff (treinador/admin) cria e gerencia os programas.
drop policy if exists training_programs_staff_all on public.training_programs;
create policy training_programs_staff_all on public.training_programs
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- Atletas podem ler programas ativos (para futura sugestão no portal).
drop policy if exists training_programs_read on public.training_programs;
create policy training_programs_read on public.training_programs
  for select
  using (active = true);
