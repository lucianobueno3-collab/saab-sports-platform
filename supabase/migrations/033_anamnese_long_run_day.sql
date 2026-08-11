-- Dia preferido para o treino longo (longão), escolhido pelo aluno na anamnese.
-- 0=segunda … 6=domingo. O encaixe do programa coloca o longão nesse dia.
alter table public.anamneses add column if not exists long_run_day int;
