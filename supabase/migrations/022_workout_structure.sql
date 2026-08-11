-- Migration 022: treino estruturado (passos por zona) nos treinos programados
-- structure: [{type:'step', step:{kind,min,zone,note}} | {type:'repeat', times, steps:[...]}]

alter table public.planned_workouts add column if not exists structure jsonb;
