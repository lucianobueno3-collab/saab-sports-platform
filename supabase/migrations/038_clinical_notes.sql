-- ─────────────────────────────────────────────────────────────────────────
-- Prontuário clínico (equipe multidisciplinar)
--
-- Evolução clínica no formato SOAP, que é como o médico registra atendimento:
--   S (subjetivo)  → queixa relatada pelo atleta
--   O (objetivo)   → exame físico / achados
--   A (avaliação)  → hipótese diagnóstica
--   P (plano)      → conduta, tratamento, retorno
--
-- Cada atendimento é uma linha, carimbada com autor e data, alimentando a
-- linha do tempo de saúde junto com exames, lesões e pareceres.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.clinical_notes (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  author_id       uuid,                     -- auth.users.id de quem atendeu
  author_name     text,
  author_role     text,                     -- doctor | coach | admin
  note_date       date not null default current_date,
  chief_complaint text,                     -- S — queixa principal
  findings        text,                     -- O — exame físico / achados
  assessment      text,                     -- A — hipótese diagnóstica
  plan            text,                     -- P — conduta / tratamento
  follow_up_at    date,                     -- retorno sugerido
  private         boolean not null default false,  -- true = só equipe clínica vê
  created_at      timestamptz not null default now()
);

create index if not exists idx_clinical_notes_athlete
  on public.clinical_notes (athlete_id, note_date desc);

alter table public.clinical_notes enable row level security;

-- Equipe clínica (médico/treinador/admin) lê o prontuário.
drop policy if exists clinical_notes_staff_read on public.clinical_notes;
create policy clinical_notes_staff_read on public.clinical_notes
  for select using (public.is_medical_staff());

-- Médico e admin escrevem/editam.
drop policy if exists clinical_notes_doctor_write on public.clinical_notes;
create policy clinical_notes_doctor_write on public.clinical_notes
  for all
  using (public.get_my_role() in ('doctor', 'admin'))
  with check (public.get_my_role() in ('doctor', 'admin'));

-- O atleta lê a própria evolução, exceto as notas marcadas como privadas.
drop policy if exists clinical_notes_owner_read on public.clinical_notes;
create policy clinical_notes_owner_read on public.clinical_notes
  for select using (athlete_id = public.my_athlete_id() and private = false);
