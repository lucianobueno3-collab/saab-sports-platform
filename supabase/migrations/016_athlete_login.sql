-- Migration 016: login do atleta no app (conta própria + autoacesso)

-- Vincula um atleta a uma conta de usuário (auth.users)
alter table public.athletes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_athletes_user on public.athletes(user_id);

-- ─── RLS: atleta enxerga e escreve os próprios dados ────────────────────────
-- (políticas aditivas — coexistem com as políticas de coach, que são OR)

-- Atleta lê o próprio cadastro
drop policy if exists "athlete_self_select" on public.athletes;
create policy "athlete_self_select" on public.athletes for select
  using (user_id = auth.uid());

-- Atleta lê as próprias métricas / atividades
drop policy if exists "athlete_self_metrics" on public.daily_metrics;
create policy "athlete_self_metrics" on public.daily_metrics for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

drop policy if exists "athlete_self_activities" on public.activities;
create policy "athlete_self_activities" on public.activities for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

-- Atleta lê os próprios programas de força
drop policy if exists "athlete_self_programs" on public.strength_programs;
create policy "athlete_self_programs" on public.strength_programs for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

-- Atleta lê e grava os próprios check-ins
drop policy if exists "athlete_self_checkins_select" on public.athlete_checkins;
create policy "athlete_self_checkins_select" on public.athlete_checkins for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

drop policy if exists "athlete_self_checkins_insert" on public.athlete_checkins;
create policy "athlete_self_checkins_insert" on public.athlete_checkins for insert
  with check (athlete_id in (select id from public.athletes where user_id = auth.uid()));

-- Atleta lê e grava os próprios treinos de força
drop policy if exists "athlete_self_logs_select" on public.strength_logs;
create policy "athlete_self_logs_select" on public.strength_logs for select
  using (athlete_id in (select id from public.athletes where user_id = auth.uid()));

drop policy if exists "athlete_self_logs_insert" on public.strength_logs;
create policy "athlete_self_logs_insert" on public.strength_logs for insert
  with check (athlete_id in (select id from public.athletes where user_id = auth.uid()));

-- ─── Vínculo por código de acesso (portal_token) ────────────────────────────
-- O atleta cria a conta e informa o código do treinador; isto liga a conta ao
-- cadastro de atleta. Retorna jsonb com ok/erro.
create or replace function public.claim_athlete_profile(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'nao_autenticado');
  end if;

  select * into v_athlete from public.athletes where portal_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'codigo_invalido');
  end if;

  -- já vinculado a outra conta
  if v_athlete.user_id is not null and v_athlete.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'ja_vinculado');
  end if;

  update public.athletes set user_id = auth.uid() where id = v_athlete.id;
  return jsonb_build_object('ok', true, 'athlete_id', v_athlete.id, 'full_name', v_athlete.full_name);
end;
$$;

grant execute on function public.claim_athlete_profile(uuid) to authenticated;

-- Retorna o id do atleta vinculado à conta logada (null se for treinador)
create or replace function public.my_athlete_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.athletes where user_id = auth.uid() limit 1;
$$;

grant execute on function public.my_athlete_id() to authenticated;
