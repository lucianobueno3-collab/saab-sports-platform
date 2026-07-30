-- ═════════════════════════════════════════════════════════════════════════
-- SAAB SPORTS — SETUP COMPLETO DA ÁREA DE SAÚDE
--
-- Script único e idempotente (pode rodar mais de uma vez sem quebrar).
-- Reúne as migrações 036, 037 e 038:
--   036 — Exames de sangue estruturados (todos os marcadores, por data)
--   037 — Papel MÉDICO + Liberação médica (apto / restrição / inapto)
--   038 — Prontuário clínico (evolução SOAP)
--
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- Esperado ao final: "Success. No rows returned".
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 0) Funções de apoio usadas pelas policies (garantia de existência)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_role()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return (select role from public.profiles where id = auth.uid());
end;
$$;
grant execute on function public.get_my_role() to authenticated;

create or replace function public.is_doctor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.get_my_role() = 'doctor', false);
$$;

create or replace function public.is_medical_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.get_my_role() in ('doctor', 'coach', 'admin'), false);
$$;

grant execute on function public.is_doctor() to authenticated;
grant execute on function public.is_medical_staff() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 036 — EXAMES DE SANGUE
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.blood_exams (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  exam_date   date not null,
  lab         text,
  notes       text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.blood_exam_values (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.blood_exams(id) on delete cascade,
  marker_key  text not null,
  value       numeric,
  unit        text,
  unique (exam_id, marker_key)
);

create index if not exists idx_blood_exams_athlete on public.blood_exams (athlete_id, exam_date desc);
create index if not exists idx_blood_exam_values_exam on public.blood_exam_values (exam_id);

alter table public.blood_exams enable row level security;
alter table public.blood_exam_values enable row level security;

drop policy if exists blood_exams_staff_all on public.blood_exams;
create policy blood_exams_staff_all on public.blood_exams
  for all using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

drop policy if exists blood_exams_owner on public.blood_exams;
create policy blood_exams_owner on public.blood_exams
  for all using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

drop policy if exists blood_exam_values_staff_all on public.blood_exam_values;
create policy blood_exam_values_staff_all on public.blood_exam_values
  for all using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

drop policy if exists blood_exam_values_owner on public.blood_exam_values;
create policy blood_exam_values_owner on public.blood_exam_values
  for all using (exists (select 1 from public.blood_exams e where e.id = exam_id and e.athlete_id = public.my_athlete_id()))
  with check (exists (select 1 from public.blood_exams e where e.id = exam_id and e.athlete_id = public.my_athlete_id()));

-- ═════════════════════════════════════════════════════════════════════════
-- 037 — PAPEL MÉDICO + LIBERAÇÃO MÉDICA
-- ═════════════════════════════════════════════════════════════════════════

-- Papel 'doctor' aceito em profiles (recria o CHECK antigo, se houver).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
exception when undefined_table then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('athlete', 'coach', 'admin', 'doctor'));
exception when duplicate_object then null;
end $$;

create table if not exists public.medical_clearances (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  doctor_id    uuid,
  doctor_name  text,
  doctor_crm   text,
  status       text not null check (status in ('apto', 'apto_restricao', 'inapto')),
  assessed_at  date not null default current_date,
  valid_until  date,
  restrictions text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_medical_clearances_athlete
  on public.medical_clearances (athlete_id, assessed_at desc);

alter table public.medical_clearances enable row level security;

drop policy if exists medical_clearances_staff_read on public.medical_clearances;
create policy medical_clearances_staff_read on public.medical_clearances
  for select using (public.is_medical_staff());

drop policy if exists medical_clearances_doctor_write on public.medical_clearances;
create policy medical_clearances_doctor_write on public.medical_clearances
  for all
  using (public.get_my_role() in ('doctor', 'admin'))
  with check (public.get_my_role() in ('doctor', 'admin'));

drop policy if exists medical_clearances_owner_read on public.medical_clearances;
create policy medical_clearances_owner_read on public.medical_clearances
  for select using (athlete_id = public.my_athlete_id());

-- Médico: leitura do cadastro dos atletas
drop policy if exists athletes_doctor_read on public.athletes;
create policy athletes_doctor_read on public.athletes
  for select using (public.is_doctor());

-- Médico: gerencia os dados CLÍNICOS
do $$
declare t text;
begin
  foreach t in array array[
    'injuries', 'medical_exams', 'medical_records', 'athlete_medical_profile',
    'blood_exams', 'blood_exam_values', 'athlete_metrics', 'body_composition',
    'nutrition_plans', 'athlete_documents'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_doctor_all', t);
      execute format(
        'create policy %I on public.%I for all using (public.is_doctor()) with check (public.is_doctor())',
        t || '_doctor_all', t);
    end if;
  end loop;
end $$;

-- Médico: LEITURA de treino e fisiologia (correlacionar carga × lesão × fadiga)
do $$
declare t text;
begin
  foreach t in array array[
    'planned_workouts', 'activities', 'daily_metrics', 'athlete_checkins',
    'strength_logs', 'strength_programs', 'competitions', 'athlete_goals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_doctor_read', t);
      execute format(
        'create policy %I on public.%I for select using (public.is_doctor())',
        t || '_doctor_read', t);
    end if;
  end loop;
end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 038 — PRONTUÁRIO CLÍNICO (evolução SOAP)
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.clinical_notes (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  author_id       uuid,
  author_name     text,
  author_role     text,
  note_date       date not null default current_date,
  chief_complaint text,
  findings        text,
  assessment      text,
  plan            text,
  follow_up_at    date,
  private         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_clinical_notes_athlete
  on public.clinical_notes (athlete_id, note_date desc);

alter table public.clinical_notes enable row level security;

drop policy if exists clinical_notes_staff_read on public.clinical_notes;
create policy clinical_notes_staff_read on public.clinical_notes
  for select using (public.is_medical_staff());

drop policy if exists clinical_notes_doctor_write on public.clinical_notes;
create policy clinical_notes_doctor_write on public.clinical_notes
  for all
  using (public.get_my_role() in ('doctor', 'admin'))
  with check (public.get_my_role() in ('doctor', 'admin'));

drop policy if exists clinical_notes_owner_read on public.clinical_notes;
create policy clinical_notes_owner_read on public.clinical_notes
  for select using (athlete_id = public.my_athlete_id() and private = false);

-- ═════════════════════════════════════════════════════════════════════════
-- FIM. Conferência rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('blood_exams','blood_exam_values','medical_clearances','clinical_notes');
-- ═════════════════════════════════════════════════════════════════════════
