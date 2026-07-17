-- Migration 015: registro de treinos de força pelo portal do atleta (por token)

create table if not exists public.strength_logs (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid references public.athletes(id) on delete cascade not null,
  program_id   uuid references public.strength_programs(id) on delete set null,
  day_label    text,                  -- rótulo do dia treinado (ex.: "A — Inferiores")
  performed_at date not null default current_date,
  rpe          integer check (rpe between 0 and 10),   -- percepção de esforço da sessão
  -- completed: [{ name, done, load, reps, notes }]
  completed    jsonb not null default '[]'::jsonb,
  notes        text,
  source       text default 'portal',  -- portal (atleta) | coach
  created_at   timestamptz default now()
);

create index if not exists idx_strength_logs_athlete on public.strength_logs(athlete_id, performed_at desc);

alter table public.strength_logs enable row level security;

-- Coach vê os registros dos seus atletas
create policy "coach_strength_logs" on public.strength_logs
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- ─── RPCs do portal (security definer — acesso por token) ───────────────────

-- Programa de força ativo do atleta (para o portal exibir o que treinar)
create or replace function public.portal_get_strength_program(p_token uuid)
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

  select to_jsonb(p) into v_result
  from (
    select id, name, goal, structure
    from public.strength_programs
    where athlete_id = v_id and active = true
    order by created_at desc
    limit 1
  ) p;

  return v_result;  -- null se não houver programa ativo
end;
$$;

-- Atleta registra um treino de força concluído
create or replace function public.portal_log_strength(
  p_token uuid,
  p_program_id uuid,
  p_day_label text,
  p_rpe integer,
  p_completed jsonb,
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

  insert into public.strength_logs (athlete_id, program_id, day_label, rpe, completed, notes, source)
  values (v_id, p_program_id, p_day_label, p_rpe, coalesce(p_completed, '[]'::jsonb), p_notes, 'portal');

  return true;
end;
$$;

-- Histórico de treinos de força do atleta (portal)
create or replace function public.portal_get_strength_logs(p_token uuid)
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

  select coalesce(jsonb_agg(l order by l.performed_at desc), '[]'::jsonb) into v_result
  from (
    select id, day_label, performed_at, rpe, completed, notes
    from public.strength_logs
    where athlete_id = v_id
    order by performed_at desc
    limit 30
  ) l;

  return v_result;
end;
$$;

grant execute on function public.portal_get_strength_program(uuid) to anon;
grant execute on function public.portal_log_strength(uuid, uuid, text, integer, jsonb, text) to anon;
grant execute on function public.portal_get_strength_logs(uuid) to anon;
