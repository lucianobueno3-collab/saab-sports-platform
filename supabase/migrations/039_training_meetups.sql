-- ─────────────────────────────────────────────────────────────────────────
-- Treinar junto — encontros de treino da comunidade
--
-- Resolve as três barreiras de quem não treina por falta de companhia:
--   coordenação  → data, hora e PONTO DE ENCONTRO com foto e referência
--   medo social  → faixa de ritmo explícita + selo "ninguém fica pra trás"
--   compromisso  → lista pública de quem confirmou presença
--
-- Podem criar: treinador/admin e os próprios alunos (o aluno vira anfitrião).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.training_meetups (
  id                 uuid primary key default gen_random_uuid(),
  created_by         uuid,                    -- auth.users.id de quem criou
  creator_name       text,
  creator_role       text,                    -- coach | admin | athlete
  athlete_id         uuid references public.athletes(id) on delete set null,
  title              text not null,
  sport              text not null default 'running',
  workout_type       text,                    -- leve | longao | intervalado | forca | livre
  meetup_date        date not null,
  meetup_time        text not null,           -- 'HH:MM'
  location_name      text not null,
  location_notes     text,                    -- "na portaria, do lado da banca"
  location_url       text,                    -- link do mapa
  location_photo_url text,                    -- foto do ponto de encontro
  pace_min_sec       int,                     -- ritmo mais rápido (s/km)
  pace_max_sec       int,                     -- ritmo mais lento (s/km)
  distance_km        numeric,
  max_people         int,
  no_one_left_behind boolean not null default true,
  notes              text,
  status             text not null default 'open' check (status in ('open', 'cancelled')),
  created_at         timestamptz not null default now()
);

create table if not exists public.meetup_participants (
  id           uuid primary key default gen_random_uuid(),
  meetup_id    uuid not null references public.training_meetups(id) on delete cascade,
  athlete_id   uuid references public.athletes(id) on delete cascade,
  user_id      uuid,
  display_name text,
  status       text not null default 'going' check (status in ('going', 'maybe')),
  created_at   timestamptz not null default now(),
  unique (meetup_id, user_id)
);

create index if not exists idx_meetups_date on public.training_meetups (meetup_date, meetup_time);
create index if not exists idx_meetup_participants on public.meetup_participants (meetup_id);

alter table public.training_meetups enable row level security;
alter table public.meetup_participants enable row level security;

-- Todo mundo autenticado enxerga os encontros (é a agenda da comunidade).
drop policy if exists meetups_read_all on public.training_meetups;
create policy meetups_read_all on public.training_meetups
  for select using (auth.uid() is not null);

-- Staff gerencia qualquer encontro.
drop policy if exists meetups_staff_all on public.training_meetups;
create policy meetups_staff_all on public.training_meetups
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- Aluno cria e gerencia os SEUS encontros (é o anfitrião).
drop policy if exists meetups_owner_write on public.training_meetups;
create policy meetups_owner_write on public.training_meetups
  for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Participantes: todos leem (saber quem vai é o ponto), cada um gerencia a sua presença.
drop policy if exists participants_read_all on public.meetup_participants;
create policy participants_read_all on public.meetup_participants
  for select using (auth.uid() is not null);

drop policy if exists participants_own on public.meetup_participants;
create policy participants_own on public.meetup_participants
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists participants_staff on public.meetup_participants;
create policy participants_staff on public.meetup_participants
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));
