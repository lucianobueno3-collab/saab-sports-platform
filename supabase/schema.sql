-- Saab Sports Platform — Supabase Schema
-- Execute no SQL Editor do Supabase

-- Enable UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- ATHLETES
-- ============================================================
create table athletes (
  id           uuid primary key default uuid_generate_v4(),
  coach_id     uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  email        text,
  avatar_url   text,
  sport        text not null default 'other', -- running | cycling | triathlon | swimming | other
  category     text,
  birth_date   date,
  weight_kg    numeric(5,2),
  height_cm    numeric(5,1),
  -- thresholds
  ftp_watts    integer,
  lthr_bpm     integer,
  vo2max       numeric(5,2),
  max_hr       integer,
  threshold_pace_sec integer, -- seconds per km
  -- meta
  goal         text,
  notes        text,
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table activities (
  id                  uuid primary key default uuid_generate_v4(),
  athlete_id          uuid references athletes(id) on delete cascade not null,
  name                text,
  sport               text,
  date                timestamptz not null,
  duration_seconds    integer,
  distance_meters     numeric(10,2),
  -- power
  avg_power_watts     integer,
  max_power_watts     integer,
  normalized_power    integer,
  intensity_factor    numeric(5,3),
  tss                 numeric(8,2),
  ftp_at_time         integer,
  -- hr
  avg_hr              integer,
  max_hr              integer,
  -- run
  avg_pace_sec_per_km integer,
  -- load (snapshot at time of activity)
  ctl_after           numeric(8,2),
  atl_after           numeric(8,2),
  tsb_after           numeric(8,2),
  -- misc
  avg_cadence         integer,
  elevation_gain_m    numeric(7,1),
  calories            integer,
  -- source
  source              text default 'manual', -- fit | csv | trainingpeaks_api | manual
  file_url            text,
  raw_data            jsonb,
  created_at          timestamptz default now()
);

-- ============================================================
-- DAILY METRICS
-- ============================================================
create table daily_metrics (
  id              uuid primary key default uuid_generate_v4(),
  athlete_id      uuid references athletes(id) on delete cascade not null,
  date            date not null,
  -- PMC
  ctl             numeric(8,2) default 0,
  atl             numeric(8,2) default 0,
  tsb             numeric(8,2) default 0,
  -- recovery
  hrv_rmssd       numeric(6,2),
  hrv_score       numeric(5,1),
  recovery_score  numeric(5,1),
  sleep_hours     numeric(4,2),
  sleep_quality   numeric(5,1),
  stress_score    numeric(5,1),
  resting_hr      integer,
  -- source
  source          text default 'calculated',
  created_at      timestamptz default now(),
  unique(athlete_id, date)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on activities(athlete_id, date desc);
create index on daily_metrics(athlete_id, date desc);
create index on athletes(coach_id, active);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table athletes    enable row level security;
alter table activities  enable row level security;
alter table daily_metrics enable row level security;

-- Coach sees only their own athletes
create policy "coach owns athletes"
  on athletes for all
  using (coach_id = auth.uid());

-- Activities follow athlete ownership
create policy "coach owns activities"
  on activities for all
  using (exists (
    select 1 from athletes a
    where a.id = activities.athlete_id and a.coach_id = auth.uid()
  ));

create policy "coach owns daily_metrics"
  on daily_metrics for all
  using (exists (
    select 1 from athletes a
    where a.id = daily_metrics.athlete_id and a.coach_id = auth.uid()
  ));

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger athletes_updated_at
  before update on athletes
  for each row execute function update_updated_at();
