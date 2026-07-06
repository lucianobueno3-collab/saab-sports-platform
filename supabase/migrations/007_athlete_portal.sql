-- Portal do Atleta: Saúde, Nutrição, Provas, Metas

-- Lesões
create table if not exists public.injuries (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid references public.athletes(id) on delete cascade not null,
  started_at   date not null,
  resolved_at  date,
  location     text not null,
  injury_type  text not null,
  severity     text default 'moderate' check (severity in ('mild', 'moderate', 'severe')),
  notes        text,
  created_at   timestamptz default now()
);

-- Exames médicos / laboratoriais
create table if not exists public.medical_exams (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid references public.athletes(id) on delete cascade not null,
  exam_date      date not null,
  exam_name      text not null,
  value          numeric,
  unit           text,
  reference_min  numeric,
  reference_max  numeric,
  notes          text,
  created_at     timestamptz default now()
);

-- Composição corporal
create table if not exists public.body_composition (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid references public.athletes(id) on delete cascade not null,
  measured_at     date not null,
  weight_kg       numeric,
  body_fat_pct    numeric,
  muscle_mass_kg  numeric,
  bone_mass_kg    numeric,
  visceral_fat    integer,
  notes           text,
  created_at      timestamptz default now()
);

-- Planos nutricionais
create table if not exists public.nutrition_plans (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid references public.athletes(id) on delete cascade not null,
  phase            text not null,
  calories_target  integer,
  protein_g        integer,
  carbs_g          integer,
  fat_g            integer,
  hydration_ml     integer,
  notes            text,
  active           boolean default true,
  created_at       timestamptz default now()
);

-- Competições / provas
create table if not exists public.competitions (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid references public.athletes(id) on delete cascade not null,
  race_date        date not null,
  name             text not null,
  sport            text,
  distance_label   text,
  goal_time_min    integer,
  result_time_min  integer,
  result_position  integer,
  dnf              boolean default false,
  priority         text default 'B' check (priority in ('A', 'B', 'C')),
  notes            text,
  created_at       timestamptz default now()
);

-- Metas do atleta
create table if not exists public.athlete_goals (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid references public.athletes(id) on delete cascade not null,
  title          text not null,
  category       text default 'performance',
  target_date    date,
  target_value   numeric,
  target_unit    text,
  current_value  numeric,
  status         text default 'active' check (status in ('active', 'achieved', 'cancelled')),
  notes          text,
  created_at     timestamptz default now()
);

-- RLS: coach acessa apenas atletas próprios
alter table public.injuries           enable row level security;
alter table public.medical_exams      enable row level security;
alter table public.body_composition   enable row level security;
alter table public.nutrition_plans    enable row level security;
alter table public.competitions       enable row level security;
alter table public.athlete_goals      enable row level security;

create policy "coach_injuries"        on public.injuries
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
create policy "coach_medical_exams"   on public.medical_exams
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
create policy "coach_body_comp"       on public.body_composition
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
create policy "coach_nutrition"       on public.nutrition_plans
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
create policy "coach_competitions"    on public.competitions
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
create policy "coach_goals"           on public.athlete_goals
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
