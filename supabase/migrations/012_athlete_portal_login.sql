-- Migration 012: portal do aluno — acesso por token + check-ins de sensações

-- Token de acesso único por atleta (compartilhado pelo coach como link)
alter table public.athletes
  add column if not exists portal_token uuid unique default gen_random_uuid();

-- Garante token para atletas já existentes
update public.athletes set portal_token = gen_random_uuid() where portal_token is null;

-- Check-ins diários reportados pelo próprio atleta
create table if not exists public.athlete_checkins (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid references public.athletes(id) on delete cascade not null,
  checkin_date   date not null default current_date,
  rpe            integer check (rpe between 0 and 10),          -- esforço percebido do último treino
  soreness       integer check (soreness between 0 and 10),     -- dor muscular
  sleep_quality  integer check (sleep_quality between 0 and 10),
  mood           integer check (mood between 0 and 10),         -- humor/energia
  pain_location  text,
  notes          text,
  source         text default 'portal',                        -- portal (aluno) ou coach
  created_at     timestamptz default now()
);

create index if not exists idx_checkins_athlete_date on public.athlete_checkins(athlete_id, checkin_date desc);

alter table public.athlete_checkins enable row level security;

-- Coach vê/gerencia check-ins dos seus atletas
create policy "coach_checkins" on public.athlete_checkins
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- ─── RPCs do portal (security definer — acesso anônimo por token, RLS travado) ──

-- Dados do atleta para o portal (nome, esporte, PMC atual, recuperação recente)
create or replace function public.portal_get_athlete(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes%rowtype;
  v_metrics jsonb;
  v_activities jsonb;
begin
  select * into v_athlete from public.athletes where portal_token = p_token;
  if not found then
    return null;
  end if;

  -- Últimas métricas diárias (PMC + recuperação)
  select to_jsonb(m) into v_metrics
  from (
    select date, ctl, atl, tsb, hrv_ms, body_battery, sleep_hours, rem_pct, resting_hr
    from public.daily_metrics
    where athlete_id = v_athlete.id
    order by date desc
    limit 1
  ) m;

  -- Últimas atividades
  select coalesce(jsonb_agg(a), '[]'::jsonb) into v_activities
  from (
    select name, sport, started_at, duration_seconds, distance_meters, tss
    from public.activities
    where athlete_id = v_athlete.id
    order by started_at desc
    limit 5
  ) a;

  return jsonb_build_object(
    'full_name', v_athlete.full_name,
    'primary_sport', v_athlete.primary_sport,
    'metrics', v_metrics,
    'activities', v_activities
  );
end;
$$;

-- Histórico de check-ins do atleta (por token)
create or replace function public.portal_get_checkins(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_result jsonb;
begin
  select id into v_id from public.athletes where portal_token = p_token;
  if not found then return null; end if;

  select coalesce(jsonb_agg(c order by c.checkin_date desc), '[]'::jsonb) into v_result
  from (
    select checkin_date, rpe, soreness, sleep_quality, mood, pain_location, notes
    from public.athlete_checkins
    where athlete_id = v_id
    order by checkin_date desc
    limit 30
  ) c;

  return v_result;
end;
$$;

-- Envio de check-in pelo atleta (upsert por dia)
create or replace function public.portal_submit_checkin(
  p_token uuid,
  p_rpe integer,
  p_soreness integer,
  p_sleep_quality integer,
  p_mood integer,
  p_pain_location text,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.athletes where portal_token = p_token;
  if not found then return false; end if;

  -- Um check-in por dia: substitui o de hoje se já existir
  delete from public.athlete_checkins where athlete_id = v_id and checkin_date = current_date and source = 'portal';
  insert into public.athlete_checkins (athlete_id, rpe, soreness, sleep_quality, mood, pain_location, notes, source)
  values (v_id, p_rpe, p_soreness, p_sleep_quality, p_mood, p_pain_location, p_notes, 'portal');

  return true;
end;
$$;

-- Permite chamada anônima das RPCs (o token é a credencial)
grant execute on function public.portal_get_athlete(uuid) to anon;
grant execute on function public.portal_get_checkins(uuid) to anon;
grant execute on function public.portal_submit_checkin(uuid, integer, integer, integer, integer, text, text) to anon;
