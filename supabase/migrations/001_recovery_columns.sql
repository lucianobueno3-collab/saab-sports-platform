-- Migration 001: Add Garmin recovery columns to daily_metrics
-- Run this in Supabase SQL Editor

alter table public.daily_metrics
  add column if not exists stress_avg      numeric(5,1) check (stress_avg between 0 and 100),
  add column if not exists stress_max      numeric(5,1) check (stress_max between 0 and 100),
  add column if not exists deep_sleep_hours  numeric(4,2) check (deep_sleep_hours between 0 and 24),
  add column if not exists light_sleep_hours numeric(4,2) check (light_sleep_hours between 0 and 24),
  add column if not exists rem_sleep_hours   numeric(4,2) check (rem_sleep_hours between 0 and 24);

comment on column public.daily_metrics.stress_avg       is 'Stress médio diário Garmin (0–100)';
comment on column public.daily_metrics.stress_max       is 'Stress máximo diário Garmin (0–100)';
comment on column public.daily_metrics.deep_sleep_hours is 'Horas de sono profundo (Garmin)';
comment on column public.daily_metrics.light_sleep_hours is 'Horas de sono leve (Garmin)';
comment on column public.daily_metrics.rem_sleep_hours  is 'Horas de sono REM (Garmin)';
