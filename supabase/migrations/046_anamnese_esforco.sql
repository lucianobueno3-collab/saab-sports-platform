-- ─────────────────────────────────────────────────────────────────────────
-- Esforço cronometrado na matrícula
--
-- O app prescreve em % do ritmo limite e converte para min/km — mas só se o
-- aluno tiver ritmo de limiar cadastrado. Até aqui esse número só existia se
-- o treinador digitasse à mão num campo escondido na ficha, e nada lembrava
-- ninguém disso: o aluno abria o treino da semana 1 e lia "10× 1min a
-- 88-98%", que não dá para executar.
--
-- Agora a matrícula pergunta uma distância e um tempo que o aluno já correu, e
-- o ritmo de limiar sai daí (Riegel, projetado para 1 hora). O valor derivado
-- vai para athletes.threshold_pace_sec_km; estas colunas guardam o esforço
-- cru, para o treinador ver de onde saiu o número e refazer a conta se quiser.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.anamneses
  add column if not exists recent_distance_km numeric,
  add column if not exists recent_time_sec    integer;
