-- Migration 021: biblioteca de treinos do treinador (cadastro reutilizável)

create table if not exists public.workout_library (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid references public.profiles(id) on delete cascade not null,
  sport        text not null default 'running',
  title        text not null,
  description  text,
  duration_min integer check (duration_min >= 0),
  tss          integer check (tss >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists idx_workout_library_coach on public.workout_library(coach_id);

alter table public.workout_library enable row level security;

drop policy if exists "coach_workout_library" on public.workout_library;
create policy "coach_workout_library" on public.workout_library for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "admin_workout_library" on public.workout_library;
create policy "admin_workout_library" on public.workout_library for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
