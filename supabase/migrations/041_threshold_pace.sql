-- ─────────────────────────────────────────────────────────────────────────
-- Ritmo de limiar (threshold pace) do corredor
--
-- Permite traduzir as zonas do treino em RITMO REAL (min/km) — que é o que o
-- corredor iniciante entende — em vez de só batimentos ou "Z2".
-- Guardado em segundos por km (ex.: 5:30/km = 330).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.athletes
  add column if not exists threshold_pace_sec_km int;

comment on column public.athletes.threshold_pace_sec_km is
  'Ritmo de limiar em segundos por km (ex.: 330 = 5:30/km). Base para as faixas de ritmo por zona.';
