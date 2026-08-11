-- ─────────────────────────────────────────────────────────────────────────
-- Grupos na biblioteca de treinos
--
-- Com dezenas de treinos vindos dos planos, uma lista única não serve. O grupo
-- é texto livre de propósito: o treinador nomeia como quiser ("1 BIKE —
-- ENDURANCE", "Provas", "Força"), sem precisar cadastrar pasta antes.
--
-- Quando os treinos de um plano vão para a biblioteca, o grupo já vem
-- preenchido com o nome do plano.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.workout_library
  add column if not exists group_name text;

-- A lista é sempre filtrada por treinador e ordenada por grupo.
create index if not exists idx_workout_library_group
  on public.workout_library (coach_id, group_name);
