-- Migration 023: biblioteca central de treinos — suporte a todas as modalidades
-- structure: passos por zona (endurance) | exercises: lista de exercícios (força)

alter table public.workout_library add column if not exists structure jsonb;
alter table public.workout_library add column if not exists exercises jsonb;
