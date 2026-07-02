-- LTHR por modalidade (triatletas têm limiar diferente por esporte)
alter table public.athletes
  add column if not exists lthr_bike_bpm integer,
  add column if not exists lthr_run_bpm  integer,
  add column if not exists lthr_swim_bpm integer;
