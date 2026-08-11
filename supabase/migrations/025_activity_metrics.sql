-- Migration 025: métricas adicionais das atividades (export do TrainingPeaks)
-- Amplia a tabela activities com os campos do WorkoutFileExport do TP, para
-- análise de treino e futuros dashboards. Colunas aditivas (idempotentes).

alter table public.activities
  add column if not exists energy_kj              integer,
  add column if not exists velocity_avg_mps       numeric(6,3),
  add column if not exists velocity_max_mps        numeric(6,3),
  add column if not exists max_cadence_rpm         integer,
  add column if not exists avg_torque_nm           numeric(6,2),
  add column if not exists max_torque_nm           numeric(6,2),
  add column if not exists rpe                     numeric(4,1),
  add column if not exists feeling                 text,
  -- minutos por zona (arrays de 10 posições) — HR e potência
  add column if not exists hr_zone_minutes         jsonb,
  add column if not exists pwr_zone_minutes        jsonb,
  -- plano e comentários vindos do TP
  add column if not exists workout_description     text,
  add column if not exists coach_comments          text,
  add column if not exists athlete_comments        text,
  add column if not exists planned_duration_seconds integer,
  add column if not exists planned_distance_meters  numeric(10,2);

comment on column public.activities.energy_kj        is 'Energia total (kJ) — TP Energy';
comment on column public.activities.velocity_avg_mps is 'Velocidade média (m/s)';
comment on column public.activities.hr_zone_minutes  is 'Minutos por zona de FC (array de 10)';
comment on column public.activities.pwr_zone_minutes is 'Minutos por zona de potência (array de 10)';
comment on column public.activities.rpe              is 'Esforço percebido (TP Rpe)';
comment on column public.activities.feeling          is 'Sensação do treino (TP Feeling)';
