-- Migration 002: Add HRV, Body Battery and REM % to daily_metrics
-- Run this in Supabase SQL Editor AFTER 001_recovery_columns.sql

alter table public.daily_metrics
  add column if not exists hrv_ms          numeric(5,1) check (hrv_ms between 0 and 200),
  add column if not exists body_battery    numeric(5,1) check (body_battery between 0 and 100),
  add column if not exists rem_pct         numeric(5,2) check (rem_pct between 0 and 100);

comment on column public.daily_metrics.hrv_ms       is 'HRV noturno médio em ms (Garmin overnight HRV)';
comment on column public.daily_metrics.body_battery is 'Body Battery Garmin ao acordar / fim do dia (0-100)';
comment on column public.daily_metrics.rem_pct      is '% de sono REM em relação ao sono total';
