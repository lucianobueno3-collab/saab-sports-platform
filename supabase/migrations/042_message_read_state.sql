-- ─────────────────────────────────────────────────────────────────────────
-- Recados: controle de lido/não lido
--
-- Sem isso não há caixa de entrada — o treinador não sabe o que já respondeu
-- e o aluno não é avisado quando a resposta chega.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.workout_comments
  add column if not exists read_by_staff   boolean not null default false,
  add column if not exists read_by_athlete boolean not null default false;

-- Mensagem do próprio staff já nasce lida por ele; idem para o aluno.
create index if not exists idx_workout_comments_unread_staff
  on public.workout_comments (read_by_staff, created_at desc) where read_by_staff = false;

create index if not exists idx_workout_comments_athlete
  on public.workout_comments (athlete_id, created_at desc);
