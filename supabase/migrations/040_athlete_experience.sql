-- ─────────────────────────────────────────────────────────────────────────
-- Experiência do aluno — "não deu hoje" + recado no treino
--
-- 1) Treino pulado/remarcado sem culpa: a causa nº1 de abandono em apps de
--    corrida é o rastro de treinos vermelhos de quem falhou um dia. Aqui o
--    aluno remarca ou pula assumidamente, e o treinador fica sabendo.
-- 2) Recado por treino: a dúvida fica presa ao treino certo, dentro do app,
--    em vez de se perder no WhatsApp.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.planned_workouts
  add column if not exists skipped     boolean not null default false,
  add column if not exists skip_reason text,
  add column if not exists moved_from  date;

create table if not exists public.workout_comments (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.planned_workouts(id) on delete cascade,
  athlete_id    uuid references public.athletes(id) on delete cascade,
  author_id     uuid,
  author_name   text,
  author_role   text,            -- athlete | coach | admin | doctor
  body          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_workout_comments_workout
  on public.workout_comments (workout_id, created_at);

alter table public.workout_comments enable row level security;

-- Staff lê e escreve em qualquer conversa.
drop policy if exists workout_comments_staff on public.workout_comments;
create policy workout_comments_staff on public.workout_comments
  for all
  using (public.get_my_role() in ('coach', 'admin', 'doctor'))
  with check (public.get_my_role() in ('coach', 'admin', 'doctor'));

-- O aluno lê e escreve na conversa dos SEUS treinos.
drop policy if exists workout_comments_owner on public.workout_comments;
create policy workout_comments_owner on public.workout_comments
  for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());
