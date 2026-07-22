-- Migration 028: laps/tiros do treino (.FIT) guardados na atividade
-- Cada volta/tiro com tempo, distância, FC, potência, cadência e velocidade,
-- para exibir "tiro a tiro" no detalhe do treino.

alter table public.activities
  add column if not exists laps jsonb;

comment on column public.activities.laps is 'Voltas/tiros do treino (array): tempo, distância, FC, potência, cadência, velocidade';
