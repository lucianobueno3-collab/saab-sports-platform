-- ─────────────────────────────────────────────────────────────────────────
-- Exercícios no treino programado
--
-- Até aqui só a corrida chegava estruturada ao calendário do aluno: o treino
-- de força virava uma frase na descrição. Com esta coluna a sessão de sala
-- viaja inteira — exercício, séries, repetições de cada série e intervalo —
-- do plano até o dia do aluno, do mesmo jeito que `structure` faz na corrida.
--
-- Formato: [{ name, muscle, sets, reps, load, rest_s, note }]
-- `reps` aceita "12" ou a pirâmide "12/12/10/8", uma repetição por série.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.planned_workouts
  add column if not exists exercises jsonb;
