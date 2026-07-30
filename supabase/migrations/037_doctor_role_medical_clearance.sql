-- ─────────────────────────────────────────────────────────────────────────
-- Equipe multidisciplinar: papel MÉDICO + LIBERAÇÃO MÉDICA
--
-- 1) Novo papel 'doctor' em profiles (equipe clínica).
-- 2) Tabela `medical_clearances`: parecer de aptidão do atleta
--    (apto | apto com restrição | inapto), com validade, restrições e notas.
--    Mantém histórico: cada avaliação é uma linha nova; a vigente é a mais
--    recente por atleta.
-- 3) RLS: o médico enxerga a parte CLÍNICA de todos os atletas e o treino em
--    modo LEITURA (para correlacionar carga × lesão × fadiga). Não acessa
--    matrículas, pagamentos nem edição de treino.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Papel 'doctor' ───────────────────────────────────────────────────────
-- Remove um eventual CHECK antigo que não conhecia 'doctor' e recria.
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

alter table public.profiles
  add constraint profiles_role_check check (role in ('athlete', 'coach', 'admin', 'doctor'));

-- Quem é equipe clínica (médico) e quem é staff que pode ver saúde.
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

-- 2) Liberação médica ─────────────────────────────────────────────────────
create table if not exists public.medical_clearances (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  doctor_id    uuid,                       -- auth.users.id de quem avaliou
  doctor_name  text,                       -- nome carimbado no parecer
  doctor_crm   text,                       -- registro profissional
  status       text not null check (status in ('apto', 'apto_restricao', 'inapto')),
  assessed_at  date not null default current_date,
  valid_until  date,                       -- vencimento do parecer (opcional)
  restrictions text,                       -- o que o atleta NÃO pode fazer
  notes        text,                       -- parecer clínico
  created_at   timestamptz not null default now()
);

create index if not exists idx_medical_clearances_athlete
  on public.medical_clearances (athlete_id, assessed_at desc);

alter table public.medical_clearances enable row level security;

-- Médico/treinador/admin leem os pareceres.
drop policy if exists medical_clearances_staff_read on public.medical_clearances;
create policy medical_clearances_staff_read on public.medical_clearances
  for select using (public.is_medical_staff());

-- Só médico e admin EMITEM/alteram parecer (treinador apenas lê).
drop policy if exists medical_clearances_doctor_write on public.medical_clearances;
create policy medical_clearances_doctor_write on public.medical_clearances
  for all
  using (public.get_my_role() in ('doctor', 'admin'))
  with check (public.get_my_role() in ('doctor', 'admin'));

-- O atleta lê o próprio parecer (saber se está liberado).
drop policy if exists medical_clearances_owner_read on public.medical_clearances;
create policy medical_clearances_owner_read on public.medical_clearances
  for select using (athlete_id = public.my_athlete_id());

-- 3) Acesso do médico ao restante ─────────────────────────────────────────
-- Cadastro dos atletas: leitura (precisa para listar e abrir a ficha).
drop policy if exists athletes_doctor_read on public.athletes;
create policy athletes_doctor_read on public.athletes
  for select using (public.is_doctor());

-- Dados CLÍNICOS: o médico gerencia (avalia e registra).
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

-- Treino e fisiologia: LEITURA apenas (correlacionar carga × lesão × fadiga).
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
