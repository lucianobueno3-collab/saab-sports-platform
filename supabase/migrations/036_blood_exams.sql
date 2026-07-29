-- ─────────────────────────────────────────────────────────────────────────
-- Exames de sangue (ficha de saúde) — armazenamento estruturado por data
--
-- `blood_exams`: um exame por data (com laboratório e observações).
-- `blood_exam_values`: um valor por marcador (glicose, colesterol, TSH, …),
-- ligado ao catálogo em src/lib/blood-markers.ts pela `marker_key`.
-- Isso permite guardar todos os campos e montar o comparativo em DADOS
-- (marcador × data), não só visual. Base para o OCR (Fase 3) preencher.
-- ─────────────────────────────────────────────────────────────────────────

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

-- Staff (treinador/admin) gerencia tudo.
drop policy if exists blood_exams_staff_all on public.blood_exams;
create policy blood_exams_staff_all on public.blood_exams
  for all using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- O próprio atleta gerencia os seus exames (portal do aluno).
drop policy if exists blood_exams_owner on public.blood_exams;
create policy blood_exams_owner on public.blood_exams
  for all using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Valores: staff gerencia tudo.
drop policy if exists blood_exam_values_staff_all on public.blood_exam_values;
create policy blood_exam_values_staff_all on public.blood_exam_values
  for all using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- Valores: o atleta gerencia os valores dos seus próprios exames.
drop policy if exists blood_exam_values_owner on public.blood_exam_values;
create policy blood_exam_values_owner on public.blood_exam_values
  for all using (exists (select 1 from public.blood_exams e where e.id = exam_id and e.athlete_id = public.my_athlete_id()))
  with check (exists (select 1 from public.blood_exams e where e.id = exam_id and e.athlete_id = public.my_athlete_id()));
