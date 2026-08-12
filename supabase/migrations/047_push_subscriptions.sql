-- ─────────────────────────────────────────────────────────────────────────
-- Inscrições de notificação (Web Push)
--
-- O aluno instalava o app e depois esquecia dele. O recado do treinador
-- ficava esperando alguém abrir a tela para ser visto — o que, na prática,
-- é o mesmo que não avisar.
--
-- Cada navegador/aparelho gera uma inscrição própria: a mesma pessoa no
-- celular e no computador aparece duas vezes aqui, o que é o correto — cada
-- um tem sua chave.
--
-- SEGURANÇA: o endpoint é uma URL secreta. Quem a tiver pode mandar
-- notificação para aquele aparelho, então RLS permite ao aluno apenas mexer
-- nas próprias linhas; quem envia é a service role, pelas Netlify Functions.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references public.athletes(id) on delete cascade not null,
  -- A URL que o navegador nos dá; é ela que identifica o aparelho.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- Só para o treinador saber de onde veio, quando for depurar.
  user_agent  text,
  created_at  timestamptz not null default now(),
  -- Última vez que um envio para este endpoint funcionou.
  last_ok_at  timestamptz
);

create index if not exists idx_push_subs_athlete on public.push_subscriptions(athlete_id);

alter table public.push_subscriptions enable row level security;

-- O aluno cuida das próprias inscrições (criar ao permitir, apagar ao desligar).
drop policy if exists "athlete_push_subs" on public.push_subscriptions;
create policy "athlete_push_subs" on public.push_subscriptions for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Treinador enxerga as dos próprios alunos, para saber quem está alcançável.
drop policy if exists "coach_push_subs" on public.push_subscriptions;
create policy "coach_push_subs" on public.push_subscriptions for select
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));
