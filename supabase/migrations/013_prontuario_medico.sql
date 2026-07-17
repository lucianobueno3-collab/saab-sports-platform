-- Migration 013: prontuário médico — avaliações com validade + anamnese

-- Avaliações/documentos médicos com gestão de validade
-- (atestado de aptidão, teste ergométrico, ECG, ecocardiograma, laboratoriais...)
create table if not exists public.medical_records (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid references public.athletes(id) on delete cascade not null,
  record_type   text not null,          -- atestado | ergometrico | ecg | ecocardiograma | laboratorial | densitometria | consulta | outro
  title         text,                   -- rótulo livre (ex.: "Teste ergométrico — esteira")
  performed_at  date not null,
  expires_at    date,                   -- validade; null = sem validade definida
  doctor_name   text,
  lab_name      text,
  result        text,                   -- p/ atestado: apto | apto_restricoes | inapto; livre nos demais
  notes         text,
  created_at    timestamptz default now()
);

create index if not exists idx_medical_records_athlete on public.medical_records(athlete_id, performed_at desc);

alter table public.medical_records enable row level security;

create policy "coach_medical_records" on public.medical_records
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- Anamnese / perfil médico do atleta (1 por atleta)
create table if not exists public.athlete_medical_profile (
  athlete_id        uuid primary key references public.athletes(id) on delete cascade,
  blood_type        text,
  allergies         text,
  medications       text,   -- medicamentos em uso
  surgeries         text,   -- cirurgias prévias
  conditions        text,   -- condições/diagnósticos (asma, diabetes...)
  family_history    text,
  emergency_contact text,
  updated_at        timestamptz default now()
);

alter table public.athlete_medical_profile enable row level security;

create policy "coach_medical_profile" on public.athlete_medical_profile
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
