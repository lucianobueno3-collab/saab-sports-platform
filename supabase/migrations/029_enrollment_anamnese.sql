-- ─────────────────────────────────────────────────────────────────────────
-- Matrícula pública + anamnese (funil "Meus primeiros 5 km")
--
-- Fluxo: a pessoa preenche a landing → cadastro (email/senha) → anamnese.
-- A Netlify Function `public-enroll` (service role) cria o usuário de auth,
-- o registro em `athletes` e uma linha em `anamneses` com status 'pending'.
-- O treinador revê a anamnese no painel e aplica o plano com 1 clique.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.anamneses (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  athlete_id       uuid references public.athletes(id) on delete cascade,
  user_id          uuid,                         -- auth.users.id do aluno
  package_key      text not null default 'primeiros_5k',
  status           text not null default 'pending',  -- pending | active | rejected
  -- Contato
  full_name        text,
  email            text,
  phone            text,
  -- Antropometria
  age              int,
  height_cm        numeric,
  weight_kg        numeric,
  -- Perfil de corrida (respostas da anamnese)
  currently_running boolean,
  running_level    text,        -- iniciante | intermediario | avancado | competitivo
  activity_level   text,        -- iniciante | intermediario | avancado (quem não corre)
  days_running     text,        -- '1_2' | '3' | '4' | '5_mais'
  weekly_distance  text,        -- 'ate_15' | '15_30' | '30_40' | '40_mais'
  goal             text,        -- 'concluir_5_10k' | 'meia_21k' | 'maratona_42k' | 'melhorar_ritmo'
  preferred_days   jsonb,       -- ex.: [0,2,5] (0=segunda … 6=domingo)
  -- Acompanhamento do treinador
  coach_notes      text,
  plan_applied_at  timestamptz
);

create index if not exists idx_anamneses_status on public.anamneses (status, created_at desc);
create index if not exists idx_anamneses_athlete on public.anamneses (athlete_id);

alter table public.anamneses enable row level security;

-- Staff (treinador/admin) vê e gerencia todas as anamneses.
drop policy if exists anamneses_staff_all on public.anamneses;
create policy anamneses_staff_all on public.anamneses
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- O próprio aluno pode ler a sua anamnese (para ver o status do plano).
drop policy if exists anamneses_owner_select on public.anamneses;
create policy anamneses_owner_select on public.anamneses
  for select
  using (user_id = auth.uid() or athlete_id = public.my_athlete_id());

-- Observação: a inserção é feita pela Function `public-enroll` com a service
-- role key (ignora RLS), então não há policy de INSERT público aqui — evita
-- que qualquer visitante grave direto na tabela.
